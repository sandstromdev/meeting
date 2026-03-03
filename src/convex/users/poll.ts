import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollInMeeting,
	assertPollOptionIndex,
	closePollIfAllEligibleHaveVoted,
	getPollOrThrow,
	getVoteByAnonId,
} from '$convex/helpers/poll';
import { requireNotAbsent } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const vote = withMe
	.mutation()
	.input({
		pollId: zid('polls'),
		optionIndex: z.number().int().nonnegative(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);

		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollOptionIndex(poll, args.optionIndex);
		requireNotAbsent(ctx.me, 'vote');

		if (!poll.isOpen) {
			throw new AppError(errors.illegal_poll_action('vote_while_closed'));
		}

		const existingVote = await getVoteByAnonId(ctx.db, args.pollId, ctx.me.anonID);
		if (existingVote) {
			throw new AppError(errors.illegal_poll_action('already_voted'));
		}

		await ctx.db.insert('pollVotes', {
			meetingId: ctx.meeting._id,
			pollId: args.pollId,
			anonID: ctx.me.anonID,
			optionIndex: args.optionIndex,
			createdAt: Date.now(),
		});

		await closePollIfAllEligibleHaveVoted(ctx.db, ctx.meeting, args.pollId);
		return true;
	});
