import type { Doc, Id } from '$convex/_generated/dataModel';
import type { PollOptionTotal } from '$convex/helpers/poll';
import { draftOptionsFromStored } from './pollOptions';
import { ABSTAIN_OPTION_LABEL } from './pollConstants';
import type { PollDraft } from './validation';

export { ABSTAIN_OPTION_LABEL } from './pollConstants';

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

export const MAJORITY_LABELS = {
	simple: 'Enkel majoritet (>50 %)',
	relative: 'Relativ majoritet (flest röster)',
	two_thirds: 'Kvalificerad majoritet (≥2/3)',
	three_quarters: '3/4 majoritet',
	unanimous: 'Enighet (100 %)',
} satisfies Record<MajorityRule, string>;

export function getMajorityRuleThreshold(rule: MajorityRule) {
	switch (rule) {
		case 'relative':
			throw new Error(
				'getMajorityRuleThreshold: relative (plurality) has no fixed fraction threshold',
			);
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
	if (rule === 'relative') {
		// Plurality: per-option threshold depends on being in the lead; this is only meaningful when compared to other counts.
		return maxVotes > 0 && votesCast >= 1;
	}
	const threshold = getMajorityRuleThreshold(rule);
	const minVotes =
		rule === 'simple' ? Math.floor(maxVotes * threshold) + 1 : Math.ceil(maxVotes * threshold);
	return votesCast >= minVotes;
}

export function minimumVotesForMajority(rule: MajorityRule, maxVotes: number) {
	if (rule === 'relative') {
		return maxVotes > 0 ? 1 : Number.POSITIVE_INFINITY;
	}
	const threshold = getMajorityRuleThreshold(rule);
	return rule === 'simple' ? Math.floor(maxVotes * threshold) + 1 : Math.ceil(maxVotes * threshold);
}

export function newPollDraft(): PollDraft {
	return {
		title: '',
		options: [
			{ title: '', description: null },
			{ title: '', description: null },
		],
		type: 'single_winner',
		winningCount: 1,
		majorityRule: 'simple',
		isResultPublic: false,
		allowsAbstain: true,
		maxVotesPerVoter: 1,
		visibilityMode: 'public',
	} satisfies PollDraft;
}

export const POLL_PRESETS = [
	{
		name: 'Ja/nej-omröstning',
		preset: () =>
			({
				...newPollDraft(),
				options: [
					{ title: 'Ja', description: null },
					{ title: 'Nej', description: null },
				],
				type: 'single_winner',
				majorityRule: 'simple',
				allowsAbstain: true,
			}) satisfies PollDraft,
	},
	{
		name: 'Personvalsomröstning',
		preset: () =>
			({
				...newPollDraft(),
				type: 'single_winner',
				winningCount: 1,
				majorityRule: 'relative',
				allowsAbstain: true,
			}) satisfies PollDraft,
	},
];

export function trimmedPollOptionTitles(draft: Pick<PollDraft, 'options'>): string[] {
	return draft.options.map((o) => o.title.trim()).filter(Boolean);
}

/** @deprecated Use `trimmedPollOptionTitles` */
export function trimmedPollOptions(draft: Pick<PollDraft, 'options'>): string[] {
	return trimmedPollOptionTitles(draft);
}

export function getEligibleVotes(optionTotals: PollOptionTotal[], allowsAbstain: boolean) {
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

export type PollTableNames = 'userPolls' | 'meetingPolls';

/** Standalone `userPolls` UI and admin mutations. */
export type UserPollDraft = PollDraft & { id?: Id<'userPolls'> };

/** Meeting agenda editor / mutations: ids are always `meetingPolls` when present. */
export type MeetingPollDraft = PollDraft & { id?: Id<'meetingPolls'> };

/** Shared editor / either table. */
export type EditablePollDraft = UserPollDraft | MeetingPollDraft;

export function hydratePollRowToDraft(p: Doc<'userPolls'>): UserPollDraft;
export function hydratePollRowToDraft(p: Doc<'meetingPolls'>): MeetingPollDraft;
export function hydratePollRowToDraft(p: Doc<PollTableNames>): UserPollDraft | MeetingPollDraft {
	const options = draftOptionsFromStored(p.options, p.allowsAbstain);

	const base: Record<string, unknown> = {
		id: p._id,
		title: p.title,
		options,
		type: p.type,
		winningCount: p.type === 'multi_winner' ? (p.winningCount ?? 1) : 1,
		majorityRule: p.type === 'single_winner' ? (p.majorityRule ?? 'simple') : 'simple',
		isResultPublic: p.isResultPublic,
		allowsAbstain: p.allowsAbstain,
		maxVotesPerVoter: p.maxVotesPerVoter,
	};

	if ('visibilityMode' in p) {
		base.visibilityMode = p.visibilityMode;
	}

	return base as UserPollDraft | MeetingPollDraft;
}
