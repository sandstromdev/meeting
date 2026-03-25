import { c } from '$convex/helpers';
import { getUserPollVotersCounter, getUserPollVotesCounter } from '$convex/helpers/counters';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const cleanupPollVotes = c
	.mutation()
	.input({ pollIds: z.array(zid('userPolls')) })
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const votes = await ctx.db
				.query('userPollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('userPollVotes', vote._id)));
			await Promise.all([
				getUserPollVotesCounter(pollId).reset(ctx),
				getUserPollVotersCounter(pollId).reset(ctx),
			]);
			deleted += votes.length;
		}
		return { deleted };
	});
