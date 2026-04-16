/** Label for the synthetic abstain option when `allowsAbstain` is true (stored as last option). */
export const ABSTAIN_OPTION_LABEL = 'Avstår';

export const POLL_TYPES = ['multi_winner', 'single_winner'] as const;
export type PollType = (typeof POLL_TYPES)[number];

export const MAJORITY_RULES = [
	'simple',
	'relative',
	'two_thirds',
	'three_quarters',
	'unanimous',
] as const;
export type MajorityRule = (typeof MAJORITY_RULES)[number];
