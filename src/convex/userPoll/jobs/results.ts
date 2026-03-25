import { c } from '$convex/helpers';
import { getUserPollOrThrow, type UserPollOptionTotal } from '$convex/helpers/userPoll';
import { ABSTAIN_OPTION_LABEL, minimumVotesForMajority } from '$lib/polls';
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

		let winners: UserPollOptionTotal[];
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
				throw new Error('user_poll_close: single_winner poll missing majorityRule');
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
