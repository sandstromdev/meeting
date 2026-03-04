import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollInMeeting,
	assertPollOptionIndex,
	closePollIfAllEligibleHaveVoted,
	getPollMaxVotesPerVoter,
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
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);

		assertPollInMeeting(poll, ctx.meeting._id);
		requireNotAbsent(ctx.me, 'vote');

		if (!poll.isOpen) {
			throw new AppError(errors.illegal_poll_action('vote_while_closed'));
		}

		const existingVote = await getVoteByAnonId(ctx.db, args.pollId, ctx.me.anonID);
		if (existingVote) {
			throw new AppError(errors.illegal_poll_action('already_voted'));
		}

		const uniqueOptionIndexes = [...new Set(args.optionIndexes)];
		if (uniqueOptionIndexes.length !== args.optionIndexes.length) {
			throw new AppError(errors.illegal_poll_action('duplicate_vote_option'));
		}
		const maxVotesPerVoter = getPollMaxVotesPerVoter(poll);
		if (uniqueOptionIndexes.length > maxVotesPerVoter) {
			throw new AppError(errors.illegal_poll_action('too_many_votes'));
		}

		for (const optionIndex of uniqueOptionIndexes) {
			assertPollOptionIndex(poll, optionIndex);
		}

		const now = Date.now();
		await Promise.all(
			uniqueOptionIndexes.map((optionIndex) =>
				ctx.db.insert('pollVotes', {
					meetingId: ctx.meeting._id,
					pollId: args.pollId,
					anonID: ctx.me.anonID,
					optionIndex,
					createdAt: now,
				}),
			),
		);

		await closePollIfAllEligibleHaveVoted(ctx.db, ctx.meeting, args.pollId);
		return true;
	});
