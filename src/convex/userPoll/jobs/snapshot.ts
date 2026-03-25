import { internal } from '$convex/_generated/api';
import { c } from '$convex/helpers';
import {
	buildUserPollResultSnapshot,
	getLatestUserPollResultSnapshot,
} from '$convex/helpers/userPoll';
import { FullUserPollSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const insertPollResultSnapshot = c
	.mutation()
	.input({
		poll: FullUserPollSchema,
		complete: z.boolean(),
		results: z.object({
			optionTotals: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			winners: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			isTie: z.boolean(),
			majorityRule: z.enum(['simple', 'two_thirds', 'three_quarters', 'unanimous']).nullable(),
			counts: z.object({
				totalVotes: z.number(),
				usableVotes: z.number(),
				abstain: z.number(),
			}),
		}),
	})
	.internal(async ({ ctx, args }) => {
		if (args.poll.closedAt == null) {
			return false;
		}

		const latestSnapshot = await getLatestUserPollResultSnapshot(ctx.db, args.poll._id);
		if (latestSnapshot?.closedAt === args.poll.closedAt) {
			return false;
		}

		await ctx.db.insert('userPollResults', buildUserPollResultSnapshot(args));
		return true;
	});

export const createPollResultSnapshotAction = c
	.action()
	.input({ pollId: zid('userPolls') })
	.internal(async ({ ctx, args }): Promise<boolean> => {
		const results = await ctx.runQuery(internal.userPoll.jobs.results.getPollResults, {
			pollId: args.pollId,
		});
		if (results.poll.isOpen || results.poll.closedAt == null) {
			return false;
		}
		return await ctx.runMutation(internal.userPoll.jobs.snapshot.insertPollResultSnapshot, results);
	});
