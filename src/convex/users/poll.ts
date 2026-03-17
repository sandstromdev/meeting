import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import { assertPollInMeeting, computeWinners, getPollOrThrow } from '$convex/helpers/poll';
import {
	getAbsentCounter,
	getParticipantCounter,
	getVotesCounter,
	getVotersCounter,
	getAllCounters,
} from '$convex/helpers/counters';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const vote = withMe
	.mutation()
	.input({
		pollId: zid('polls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);

		assertPollInMeeting(poll, ctx.meeting._id);

		AppError.assert(ctx.me.absentSince <= 0, errors.illegal_while_absent('vote'));
		AppError.assert(poll.isOpen, errors.illegal_poll_action('vote_while_closed'));

		const hasVoted = await ctx.db
			.query('pollVotes')
			.withIndex('by_poll_user', (q) => q.eq('pollId', args.pollId).eq('userId', ctx.me._id))
			.first();

		AppError.assert(!hasVoted, errors.illegal_poll_action('already_voted'));

		const uniqueOptionIndexes = [...new Set(args.optionIndexes)];

		AppError.assert(
			uniqueOptionIndexes.length === args.optionIndexes.length,
			errors.illegal_poll_action('duplicate_vote_option'),
		);

		const maxVotesPerVoter =
			poll.type === 'multi_winner' ? poll.winningCount : poll.maxVotesPerVoter;

		AppError.assert(
			uniqueOptionIndexes.length <= maxVotesPerVoter,
			errors.illegal_poll_action('too_many_votes'),
		);

		for (const optionIndex of uniqueOptionIndexes) {
			AppError.assert(
				optionIndex >= 0 && optionIndex < poll.options.length,
				errors.invalid_poll_option(optionIndex),
			);
		}

		await Promise.all(
			uniqueOptionIndexes.map((optionIndex) =>
				ctx.db.insert('pollVotes', {
					meetingId: ctx.meeting._id,
					pollId: args.pollId,
					userId: ctx.me._id,
					optionIndex,
				}),
			),
		);

		await Promise.all([
			getVotesCounter(ctx.meeting._id, args.pollId).add(ctx, uniqueOptionIndexes.length),
			getVotersCounter(ctx.meeting._id, args.pollId).inc(ctx),
		]);

		return true;
	});

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
				.query('polls')
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
						.query('pollVotes')
						.withIndex('by_poll_user', (q) => q.eq('pollId', poll._id).eq('userId', ctx.me._id))
						.collect(),
				]);

				const myVoteOptionIndexes = myVotes.map((v) => v.optionIndex);
				const hasVoted = myVoteOptionIndexes.length > 0;

				const pollMaxVotes =
					poll.type === 'single_winner' ? eligibleVoters : eligibleVoters * poll.maxVotesPerVoter;

				const optionTotals = poll.options.map((option, optionIndex) => ({
					optionIndex,
					option,
					votes: 0,
				}));

				const winners = poll.isOpen
					? null
					: computeWinners(poll, optionTotals, votesCount, pollMaxVotes);

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
					winnerOptionIndexes: winners?.winnerOptionIndexes,
					isTie: winners?.isTie,
				};
			}),
		);
	});

export const getCurrentPoll = withMe.query().public(async ({ ctx }) => {
	const pollId = ctx.meeting.currentPollId;

	if (!pollId) {
		return null;
	}

	const poll = await ctx.db.get('polls', pollId);

	if (!poll || poll.meetingId !== ctx.meeting._id) {
		return null;
	}

	const counters = getAllCounters(ctx.meeting._id);

	const [participants, absentees, votesCount, votersCount] = await Promise.all([
		counters.participants.count(ctx),
		counters.absent.count(ctx),
		counters.votes(poll._id).count(ctx),
		counters.voters(poll._id).count(ctx),
	]);

	let votes = await ctx.db
		.query('pollVotes')
		.withIndex('by_poll_user', (q) => q.eq('pollId', poll._id).eq('userId', ctx.me._id))
		.collect();

	const eligibleVoters = Math.max(0, participants - absentees);

	const myVoteOptionIndexes = votes.map((v) => v.optionIndex);

	const hasVoted = myVoteOptionIndexes.length > 0;

	return {
		id: poll._id,
		title: poll.title,
		options: poll.options,
		isOpen: poll.isOpen,
		maxVotesPerVoter: poll.maxVotesPerVoter,
		type: poll.type,
		votesCount,
		votersCount,
		eligibleVoters,
		hasVoted,
		myVoteOptionIndexes,
	};
});

export const getPollResultsById = withMe
	.query()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);

		if (poll.isOpen) {
			return null;
		}

		const [participants, absentees, votes] = await Promise.all([
			getParticipantCounter(ctx.meeting._id).count(ctx),
			getAbsentCounter(ctx.meeting._id).count(ctx),
			ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
				.collect(),
		]);

		const eligibleVoters = Math.max(0, participants - absentees);
		const votesCount = votes.length;
		const votersCount = new Set(votes.map((v) => v.userId)).size;

		const optionTotals = poll.options.map((option, optionIndex) => ({
			optionIndex,
			option,
			votes: 0,
		}));

		for (const vote of votes) {
			if (vote.optionIndex >= 0 && vote.optionIndex < optionTotals.length) {
				optionTotals[vote.optionIndex].votes += 1;
			}
		}

		const pollMaxVotes =
			poll.type === 'single_winner' ? eligibleVoters : eligibleVoters * poll.maxVotesPerVoter;

		const winners = computeWinners(poll, optionTotals, votesCount, pollMaxVotes);

		const canSeeOptionTotals = poll.isResultPublic || ctx.me.role === 'admin';

		return {
			pollId: poll._id,
			votesCount,
			votersCount,
			winnerOptionIndexes: winners.winnerOptionIndexes,
			isTie: winners.isTie,
			optionTotals: canSeeOptionTotals ? optionTotals : undefined,
		};
	});
