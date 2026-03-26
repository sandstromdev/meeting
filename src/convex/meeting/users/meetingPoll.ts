import { withMe } from '$convex/helpers/auth';
import {
	getAbsentCounter,
	getParticipantCounter,
	getVotersCounter,
	getVotesCounter,
} from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import { assertValidPollVoteOptionIndexes } from '$convex/helpers/poll';
import {
	assertMeetingPollInMeeting,
	getLatestMeetingPollResultSnapshot,
	getMeetingPollOrThrow,
} from '$convex/helpers/meetingPoll';
import { bumpMeetingRuntimeVersions } from '$convex/helpers/meetingRuntime';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

export const getPollsByAgendaItemId = withMe
	.query()
	.input({
		agendaItemId: z.string().min(1),
	})
	.public(async ({ ctx, args }) => {
		const [participants, absentees, polls] = await Promise.all([
			getParticipantCounter(ctx.meeting._id).count(ctx),
			getAbsentCounter(ctx.meeting._id).count(ctx),
			ctx.db
				.query('meetingPolls')
				.withIndex('by_meeting_agendaItem', (q) =>
					q.eq('meetingId', ctx.meeting._id).eq('agendaItemId', args.agendaItemId),
				)
				.collect(),
		]);

		const eligibleVoters = Math.max(0, participants - absentees);

		return Promise.all(
			polls.map(async (poll) => {
				const [votesCount, votersCount, myVotes] = await Promise.all([
					getVotesCounter(ctx.meeting._id, poll._id).count(ctx),
					getVotersCounter(ctx.meeting._id, poll._id).count(ctx),
					ctx.db
						.query('meetingPollVotes')
						.withIndex('by_poll_user', (q) => q.eq('pollId', poll._id).eq('userId', ctx.me._id))
						.collect(),
				]);

				const myVoteOptionIndexes = myVotes.map((v) => v.optionIndex);
				const hasVoted = myVoteOptionIndexes.length > 0;

				const latestResult =
					!poll.isOpen && poll.closedAt != null
						? await getLatestMeetingPollResultSnapshot(ctx.db, poll._id)
						: null;

				return {
					id: poll._id,
					title: poll.title,
					options: poll.options,
					isOpen: poll.isOpen,
					maxVotesPerVoter: poll.maxVotesPerVoter,
					votesCount,
					votersCount,
					eligibleVoters,
					hasVoted,
					myVoteOptionIndexes,
					winnerOptionIndexes: latestResult?.results.winners.map((winner) => winner.optionIndex),
					isTie: latestResult?.results.isTie,
				};
			}),
		);
	});

export const getCurrentPoll = withMe.query().public(async ({ ctx }) => {
	const pollId = ctx.meeting.currentPollId;

	if (!pollId) {
		return null;
	}

	const poll = await ctx.db.get('meetingPolls', pollId);

	if (!poll || poll.meetingId !== ctx.meeting._id) {
		return null;
	}

	let votes = await ctx.db
		.query('meetingPollVotes')
		.withIndex('by_poll_user', (q) => q.eq('pollId', poll._id).eq('userId', ctx.me._id))
		.collect();

	const myVoteOptionIndexes = votes.map((v) => v.optionIndex);

	const hasVoted = myVoteOptionIndexes.length > 0;

	return {
		id: poll._id,
		title: poll.title,
		options: poll.options,
		isOpen: poll.isOpen,
		maxVotesPerVoter: poll.maxVotesPerVoter,
		isResultPublic: poll.isResultPublic,
		type: poll.type,
		hasVoted,
		myVoteOptionIndexes,
	};
});

export const getCurrentPollCounters = withMe.query().public(async ({ ctx }) => {
	if (!ctx.meeting.currentPollId) {
		return null;
	}

	const poll = await getMeetingPollOrThrow(ctx.db, ctx.meeting.currentPollId);
	assertMeetingPollInMeeting(poll, ctx.meeting._id);

	const [participants, absentees, votersCount, votesCount] = await Promise.all([
		getParticipantCounter(ctx.meeting._id).count(ctx),
		getAbsentCounter(ctx.meeting._id).count(ctx),
		getVotersCounter(ctx.meeting._id, poll._id).count(ctx),
		getVotesCounter(ctx.meeting._id, poll._id).count(ctx),
	]);

	const eligibleVoters = Math.max(0, participants - absentees);

	return {
		votersCount,
		eligibleVoters,
		votesCount,
	};
});

export const getPollResultsById = withMe
	.query()
	.input({
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);

		if (poll.isOpen || poll.closedAt == null) {
			return null;
		}
		const result = await getLatestMeetingPollResultSnapshot(ctx.db, poll._id);

		if (!result) {
			return null;
		}

		const canSeeOptionTotals = poll.isResultPublic || ctx.me.role === 'admin';

		const winners = canSeeOptionTotals
			? result.results.winners
			: result.results.winners.map((winner) => ({
					optionIndex: winner.optionIndex,
					option: winner.option,
					votes: undefined,
				}));

		return {
			pollId: poll._id,
			complete: result.complete,
			results: {
				optionTotals: canSeeOptionTotals ? result.results.optionTotals : undefined,
				winners,
				isTie: result.results.isTie,
				majorityRule: result.results.majorityRule,
				counts: result.results.counts,
			},
		};
	});

// --- Public mutations ---

export const vote = withMe
	.mutation()
	.input({
		pollId: zid('meetingPolls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);

		assertMeetingPollInMeeting(poll, ctx.meeting._id);

		AppError.assert(ctx.me.absentSince <= 0, appErrors.illegal_while_absent('vote'));
		AppError.assert(poll.isOpen, appErrors.illegal_meeting_poll_action('vote_while_closed'));

		const uniqueOptionIndexes = assertValidPollVoteOptionIndexes(
			poll,
			args.optionIndexes,
			'meeting',
		);

		const existingVotes = await ctx.db
			.query('meetingPollVotes')
			.withIndex('by_poll_user', (q) => q.eq('pollId', args.pollId).eq('userId', ctx.me._id))
			.collect();

		if (existingVotes.length > 0) {
			await Promise.all(existingVotes.map((v) => ctx.db.delete('meetingPollVotes', v._id)));
			await getVotesCounter(ctx.meeting._id, args.pollId).subtract(ctx, existingVotes.length);
		}

		await Promise.all(
			uniqueOptionIndexes.map((optionIndex) =>
				ctx.db.insert('meetingPollVotes', {
					meetingId: ctx.meeting._id,
					pollId: args.pollId,
					userId: ctx.me._id,
					optionIndex,
				}),
			),
		);

		const counterUpdates: Promise<unknown>[] = [
			getVotesCounter(ctx.meeting._id, args.pollId).add(ctx, uniqueOptionIndexes.length),
		];
		if (existingVotes.length === 0) {
			counterUpdates.push(getVotersCounter(ctx.meeting._id, args.pollId).inc(ctx));
		}
		await Promise.all(counterUpdates);
		await bumpMeetingRuntimeVersions(ctx, ctx.meeting._id, { hot: true });

		return true;
	});

export const retractVote = withMe
	.mutation()
	.input({
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);

		assertMeetingPollInMeeting(poll, ctx.meeting._id);

		AppError.assert(ctx.me.absentSince <= 0, appErrors.illegal_while_absent('vote'));
		AppError.assert(poll.isOpen, appErrors.illegal_meeting_poll_action('vote_while_closed'));

		const existingVotes = await ctx.db
			.query('meetingPollVotes')
			.withIndex('by_poll_user', (q) => q.eq('pollId', args.pollId).eq('userId', ctx.me._id))
			.collect();

		if (existingVotes.length === 0) {
			return true;
		}

		await Promise.all(existingVotes.map((v) => ctx.db.delete('meetingPollVotes', v._id)));
		await getVotesCounter(ctx.meeting._id, args.pollId).subtract(ctx, existingVotes.length);
		await getVotersCounter(ctx.meeting._id, args.pollId).dec(ctx);
		await bumpMeetingRuntimeVersions(ctx, ctx.meeting._id, { hot: true });

		return true;
	});
