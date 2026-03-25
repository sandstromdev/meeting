import { c } from '$convex/helpers';
import {
	buildOptionTotalsFromVotes,
	computePollOutcome,
	rankOptionsForScoring,
	usableVotesFromRanked,
} from '$convex/helpers/poll';
import { getUserPollOrThrow } from '$convex/helpers/userPoll';
import { zid } from 'convex-helpers/server/zod4';

export const getPollResults = c
	.query()
	.input({ pollId: zid('userPolls') })
	.internal(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		const votes = await ctx.db
			.query('userPollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
			.collect();

		const optionTotals = buildOptionTotalsFromVotes(poll.options, votes);
		const ranked = rankOptionsForScoring(optionTotals, poll.allowsAbstain);
		const usableVotes = usableVotesFromRanked(ranked);

		const {
			winners,
			isTie,
			majorityRule: resultsMajorityRule,
		} = computePollOutcome(poll, ranked, { missingMajorityRuleLabel: 'user_poll_close' });

		const votesWithoutAbstain = usableVotes;

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
