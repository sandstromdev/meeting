import type { Doc, Id } from '$convex/_generated/dataModel';
import type { PollOptionTotal } from '$convex/helpers/poll';
import type { PollDraft } from './validation';

export const POLL_TYPES = ['multi_winner', 'single_winner'] as const;
export type PollType = (typeof POLL_TYPES)[number];

export const MAJORITY_RULES = ['simple', 'two_thirds', 'three_quarters', 'unanimous'] as const;
export type MajorityRule = (typeof MAJORITY_RULES)[number];

export const ABSTAIN_OPTION_LABEL = 'Avstår';

export const MAJORITY_LABELS = {
	simple: 'Enkel majoritet (>50 %)',
	two_thirds: 'Kvalificerad majoritet (≥2/3)',
	three_quarters: '3/4 majoritet',
	unanimous: 'Enighet (100 %)',
} satisfies Record<MajorityRule, string>;

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

export function newPollDraft(): PollDraft {
	return {
		title: '',
		options: ['', ''],
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
				options: ['Ja', 'Nej'],
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
				type: 'multi_winner',
				winningCount: 1,
				majorityRule: 'simple',
				allowsAbstain: true,
			}) satisfies PollDraft,
	},
];

export function trimmedPollOptions(draft: Pick<PollDraft, 'options'>): string[] {
	return draft.options.map((o) => o.trim()).filter(Boolean);
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
	const opts = [...p.options];
	const options =
		p.allowsAbstain && opts[opts.length - 1] === ABSTAIN_OPTION_LABEL ? opts.slice(0, -1) : opts;

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
