import type { MajorityRule } from '$lib/polls';
import { getEligibleVotes, minimumVotesForMajority } from '$lib/polls';
import { AppError, appErrors } from './error';

export type PollOptionTotal = { optionIndex: number; option: string; votes: number };

export function buildOptionTotalsFromVotes(
	pollOptions: readonly string[],
	votes: Iterable<{ optionIndex: number }>,
): PollOptionTotal[] {
	const optionTotals = pollOptions.map((option, optionIndex) => ({
		optionIndex,
		option,
		votes: 0,
	}));
	for (const vote of votes) {
		if (vote.optionIndex >= 0 && vote.optionIndex < optionTotals.length) {
			optionTotals[vote.optionIndex].votes += 1;
		}
	}
	return optionTotals;
}

/** Non-abstain options for scoring, sorted by votes descending. */
export function rankOptionsForScoring(
	optionTotals: readonly PollOptionTotal[],
	allowsAbstain: boolean,
): PollOptionTotal[] {
	return getEligibleVotes([...optionTotals], allowsAbstain).toSorted((a, b) => b.votes - a.votes);
}

export function usableVotesFromRanked(rankedOptions: readonly PollOptionTotal[]): number {
	return rankedOptions.reduce((acc, o) => acc + o.votes, 0);
}

export type PollLikeForOutcome = {
	type: 'multi_winner' | 'single_winner';
	winningCount?: number | undefined;
	majorityRule?: MajorityRule | undefined;
};

export function computePollOutcome(
	poll: PollLikeForOutcome,
	rankedOptions: PollOptionTotal[],
	opts?: { missingMajorityRuleLabel?: string },
): {
	winners: PollOptionTotal[];
	isTie: boolean;
	majorityRule: MajorityRule | null;
} {
	const usableVotes = usableVotesFromRanked(rankedOptions);
	const label = opts?.missingMajorityRuleLabel ?? 'poll_close';

	let winners: PollOptionTotal[];
	let isTie: boolean;
	let resultsMajorityRule: MajorityRule | null = null;

	if (poll.type === 'multi_winner') {
		const wc = Math.max(1, Math.min(poll.winningCount ?? 1, rankedOptions.length));
		const thresholdVotes = rankedOptions[wc - 1]?.votes ?? 0;
		winners = rankedOptions.filter((o) => o.votes >= thresholdVotes);
		const lastWinnerVotes = winners[wc - 1]?.votes;
		isTie =
			lastWinnerVotes != null &&
			rankedOptions.filter((o) => o.votes === lastWinnerVotes).length > 1;
	} else {
		const rule = poll.majorityRule;
		if (rule == null) {
			throw new Error(`${label}: single_winner poll missing majorityRule`);
		}
		const minVotes = minimumVotesForMajority(rule, usableVotes);
		const topVotes = rankedOptions[0]?.votes;
		winners = rankedOptions.filter((o) => o.votes >= minVotes && o.votes === topVotes);
		isTie = winners.length > 1;
		resultsMajorityRule = rule;
	}

	return { winners, isTie, majorityRule: resultsMajorityRule };
}

export function assertValidPollVoteOptionIndexes(
	poll: {
		options: readonly string[];
		type: 'multi_winner' | 'single_winner';
		winningCount?: number | undefined;
		maxVotesPerVoter: number;
	},
	optionIndexes: number[],
	domain: 'meeting' | 'user',
): number[] {
	const uniqueOptionIndexes = [...new Set(optionIndexes)];
	const illegal = (code: 'duplicate_vote_option' | 'too_many_votes') =>
		domain === 'meeting'
			? appErrors.illegal_meeting_poll_action(code)
			: appErrors.illegal_user_poll_action(code);

	AppError.assert(
		uniqueOptionIndexes.length === optionIndexes.length,
		illegal('duplicate_vote_option'),
	);

	const maxVotesPerVoter =
		poll.type === 'multi_winner'
			? (poll.winningCount ?? poll.maxVotesPerVoter)
			: poll.maxVotesPerVoter;

	AppError.assert(uniqueOptionIndexes.length <= maxVotesPerVoter, illegal('too_many_votes'));

	for (const optionIndex of uniqueOptionIndexes) {
		AppError.assert(
			optionIndex >= 0 && optionIndex < poll.options.length,
			appErrors.invalid_poll_option(optionIndex),
		);
	}
	return uniqueOptionIndexes;
}

export function shouldSkipPollSnapshotAction(poll: {
	isOpen: boolean;
	closedAt: number | null;
}): boolean {
	return poll.isOpen || poll.closedAt == null;
}
