import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import { assertPollInMeeting, computeWinners, getPollOrThrow } from '$convex/helpers/poll';
import { getAbsentCounter, getParticipantCounter } from '$convex/helpers/counters';
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
		if (ctx.me.absentSince) {
			throw new AppError(errors.illegal_while_absent('vote'));
		}

		if (!poll.isOpen) {
			throw new AppError(errors.illegal_poll_action('vote_while_closed'));
		}

		const existingVote = await ctx.db
			.query('pollVotes')
			.withIndex('by_poll_user', (q) => q.eq('pollId', args.pollId).eq('userId', ctx.me._id))
			.first();

		if (existingVote) {
			throw new AppError(errors.illegal_poll_action('already_voted'));
		}

		const uniqueOptionIndexes = [...new Set(args.optionIndexes)];

		if (uniqueOptionIndexes.length !== args.optionIndexes.length) {
			throw new AppError(errors.illegal_poll_action('duplicate_vote_option'));
		}

		const maxVotesPerVoter =
			poll.type === 'multi_winner' ? poll.winningCount : poll.maxVotesPerVoter;

		if (uniqueOptionIndexes.length > maxVotesPerVoter) {
			throw new AppError(errors.illegal_poll_action('too_many_votes'));
		}

		for (const optionIndex of uniqueOptionIndexes) {
			if (optionIndex < 0 || optionIndex >= poll.options.length) {
				throw new AppError(errors.invalid_poll_option(optionIndex));
			}
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

		/* const eligibleVoters = Math.max(0, (ctx.meeting.participants ?? 0) - (ctx.meeting.absent ?? 0));

		if (eligibleVoters > 0) {
			const votes = await ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', args.pollId))
				.collect();
			const votersCount = new Set(votes.map((vote) => vote.userId)).size;
			if (votersCount >= eligibleVoters) {
				const now = Date.now();
				await ctx.db.patch('polls', args.pollId, {
					isOpen: false,
					closedAt: now,
					updatedAt: now,
				});
			}
		} */

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
				const votes = await ctx.db
					.query('pollVotes')
					.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
					.collect();

				const optionTotals = poll.options.map((option, optionIndex) => ({
					optionIndex,
					option,
					votes: 0,
				}));

				const voters = new Set<string>();
				const myVoteOptionIndexes: number[] = [];

				for (const vote of votes) {
					voters.add(vote.userId);
					optionTotals[vote.optionIndex].votes += 1;
					if (vote.userId === ctx.me._id) {
						myVoteOptionIndexes.push(vote.optionIndex);
					}
				}

				const hasVoted = myVoteOptionIndexes.length > 0;
				const votesCount = votes.length;
				const votersCount = voters.size;

				const pollMaxVotes =
					poll.type === 'single_winner' ? eligibleVoters : eligibleVoters * poll.maxVotesPerVoter;

				const winners = computeWinners(poll, optionTotals, votesCount, pollMaxVotes);
				const canSeeResults = !poll.isOpen && (poll.isResultPublic || ctx.me.role === 'admin');

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
					optionTotals: canSeeResults ? optionTotals : undefined,
					winnerOptionIndexes: canSeeResults ? winners.winnerOptionIndexes : undefined,
					isTie: canSeeResults ? winners.isTie : undefined,
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

	const [participants, absentees, votes] = await Promise.all([
		getParticipantCounter(ctx.meeting._id).count(ctx),
		getAbsentCounter(ctx.meeting._id).count(ctx),
		ctx.db
			.query('pollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
			.collect(),
	]);

	const eligibleVoters = Math.max(0, participants - absentees);

	const optionTotals = poll.options.map((option, optionIndex) => ({
		optionIndex,
		option,
		votes: 0,
	}));

	const voters = new Set<string>();
	const myVoteOptionIndexes: number[] = [];

	for (const vote of votes) {
		voters.add(vote.userId);
		optionTotals[vote.optionIndex].votes += 1;
		if (vote.userId === ctx.me._id) {
			myVoteOptionIndexes.push(vote.optionIndex);
		}
	}

	const hasVoted = myVoteOptionIndexes.length > 0;
	const votesCount = votes.length;
	const votersCount = voters.size;

	const pollMaxVotes =
		poll.type === 'single_winner' ? eligibleVoters : eligibleVoters * poll.maxVotesPerVoter;
	const winners = computeWinners(poll, optionTotals, votesCount, pollMaxVotes);
	const canSeeTotals = !poll.isOpen && (poll.isResultPublic || ctx.me.role === 'admin');

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
		optionTotals: canSeeTotals ? optionTotals : undefined,
		winnerOptionIndexes: winners.winnerOptionIndexes,
		isTie: winners.isTie,
	};
});
