import type { OptionTotal } from '$convex/helpers/meetingPoll';

export const POLL_TYPES = ['multi_winner', 'single_winner'] as const;
export type PollType = (typeof POLL_TYPES)[number];

export const MAJORITY_RULES = ['simple', 'two_thirds', 'three_quarters', 'unanimous'] as const;
export type MajorityRule = (typeof MAJORITY_RULES)[number];

export const ABSTAIN_OPTION_LABEL = 'Avstår';

export function getMajorityRuleThreshold(rule: MajorityRule) {
	switch (rule) {
		case 'simple':
			return 0.5;
		case 'two_thirds':
			return 2 / 3;
		case 'three_quarters':
			return 0.75;
		case 'unanimous':
			return 1;
	}
}

export function meetsMajorityThreshold(rule: MajorityRule, votesCast: number, maxVotes: number) {
	const threshold = getMajorityRuleThreshold(rule);
	const minVotes =
		rule === 'simple' ? Math.floor(maxVotes * threshold) + 1 : Math.ceil(maxVotes * threshold);
	return votesCast >= minVotes;
}

export function minimumVotesForMajority(rule: MajorityRule, maxVotes: number) {
	const threshold = getMajorityRuleThreshold(rule);
	return rule === 'simple' ? Math.floor(maxVotes * threshold) + 1 : Math.ceil(maxVotes * threshold);
}

export const MAJORITY_LABELS = {
	simple: 'Enkel majoritet (>50 %)',
	two_thirds: 'Kvalificerad majoritet (≥2/3)',
	three_quarters: '3/4 majoritet',
	unanimous: 'Enighet (100 %)',
} satisfies Record<MajorityRule, string>;

export function getEligibleVotes(optionTotals: OptionTotal[], allowsAbstain: boolean) {
	return allowsAbstain
		? optionTotals.filter((o) => o.option !== ABSTAIN_OPTION_LABEL)
		: optionTotals;
}

export function getVoteShare(votes: number, total: number) {
	if (total <= 0) {
		return '0.0';
	}

	return ((votes / total) * 100).toFixed(1);
}
