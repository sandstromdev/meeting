import { c } from '@lsnd/convex/helpers';
import { getVotesCounter, getVotersCounter } from '@lsnd/convex/helpers/counters';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const cleanupPollVotes = c
	.mutation()
	.input({
		meetingId: zid('meetings'),
		pollIds: z.array(zid('meetingPolls')),
	})
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const votes = await ctx.db
				.query('meetingPollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('meetingPollVotes', vote._id)));

			await Promise.all([
				getVotesCounter(args.meetingId, pollId).reset(ctx),
				getVotersCounter(args.meetingId, pollId).reset(ctx),
			]);

			deleted += votes.length;
		}
		return { deleted };
	});

export const cleanupPollAgendaItemIds = c
	.mutation()
	.input({
		pollIds: z.array(zid('meetingPolls')),
	})
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const poll = await ctx.db.get('meetingPolls', pollId);
			if (poll) {
				await ctx.db.patch('meetingPolls', pollId, { agendaItemId: null });
				deleted += 1;
			}
		}
		return { deleted };
	});
