import { internal } from '$convex/_generated/api';
import { c } from '$convex/helpers';
import { getStandaloneVotersCounter, getStandaloneVotesCounter } from '$convex/helpers/counters';
import {
	buildStandalonePollResultSnapshot,
	getLatestStandalonePollResultSnapshot,
	getStandalonePollOrThrow,
	type StandaloneOptionTotal,
} from '$convex/helpers/standalone_poll';
import { ABSTAIN_OPTION_LABEL, minimumVotesForMajority } from '$lib/polls';
import { FullStandalonePollSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const getPollResults = c
	.query()
	.input({ pollId: zid('standalonePolls') })
	.internal(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		const votes = await ctx.db
			.query('standalonePollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
			.collect();

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

		const options = (
			poll.allowsAbstain
				? optionTotals.filter((o) => o.option !== ABSTAIN_OPTION_LABEL)
				: optionTotals
		).toSorted((a, b) => b.votes - a.votes);
		const usableVotes = options.reduce((acc, o) => acc + o.votes, 0);

		let winners: StandaloneOptionTotal[];
		let isTie: boolean;
		let resultsMajorityRule: (typeof poll)['majorityRule'] | null = null;

		if (poll.type === 'multi_winner') {
			const wc = Math.max(1, Math.min(poll.winningCount ?? 1, options.length));
			const thresholdVotes = options[wc - 1]?.votes ?? 0;
			winners = options.filter((o) => o.votes >= thresholdVotes);
			const lastWinnerVotes = winners[wc - 1]?.votes;
			isTie =
				lastWinnerVotes != null && options.filter((o) => o.votes === lastWinnerVotes).length > 1;
		} else {
			const rule = poll.majorityRule;
			if (rule == null) {
				throw new Error('standalone_poll_close: single_winner poll missing majorityRule');
			}
			const minVotes = minimumVotesForMajority(rule, usableVotes);
			const topVotes = options[0]?.votes;
			winners = options.filter((o) => o.votes >= minVotes && o.votes === topVotes);
			isTie = winners.length > 1;
			resultsMajorityRule = rule;
		}

		const votesWithoutAbstain = options.reduce((acc, o) => acc + o.votes, 0);

		return {
			poll,
			complete: true,
			results: {
				optionTotals,
				winners,
				isTie,
				majorityRule: resultsMajorityRule,
				counts: {
					totalVotes: votes.length,
					usableVotes,
					abstain: votes.length - votesWithoutAbstain,
				},
			},
		};
	});

export const cleanupPollVotes = c
	.mutation()
	.input({ pollIds: z.array(zid('standalonePolls')) })
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const votes = await ctx.db
				.query('standalonePollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('standalonePollVotes', vote._id)));
			await Promise.all([
				getStandaloneVotesCounter(pollId).reset(ctx),
				getStandaloneVotersCounter(pollId).reset(ctx),
			]);
			deleted += votes.length;
		}
		return { deleted };
	});

export const insertPollResultSnapshot = c
	.mutation()
	.input({
		poll: FullStandalonePollSchema,
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

		const latestSnapshot = await getLatestStandalonePollResultSnapshot(ctx.db, args.poll._id);
		if (latestSnapshot?.closedAt === args.poll.closedAt) {
			return false;
		}

		await ctx.db.insert('standalonePollResults', buildStandalonePollResultSnapshot(args));
		return true;
	});

export const createPollResultSnapshotAction = c
	.action()
	.input({ pollId: zid('standalonePolls') })
	.internal(async ({ ctx, args }): Promise<boolean> => {
		const results = await ctx.runQuery(internal.polls.jobs.standalone_polls.getPollResults, {
			pollId: args.pollId,
		});
		if (results.poll.isOpen || results.poll.closedAt == null) {
			return false;
		}
		return await ctx.runMutation(
			internal.polls.jobs.standalone_polls.insertPollResultSnapshot,
			results,
		);
	});
