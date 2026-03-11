import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import { assertPollInMeeting, getPollOrThrow } from '$convex/helpers/poll';
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
					createdAt: Date.now(),
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
