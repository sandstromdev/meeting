import type { Id } from '$convex/_generated/dataModel';
import type { MajorityRule, PollType } from '$convex/schema';

export type { MajorityRule, PollType };

export type PollDraft = {
	id?: Id<'polls'>;
	title: string;
	options: string[];
	type: PollType;
	winningCount: number;
	majorityRule: MajorityRule;
	resultsPublic: boolean;
	includeVacantOption: boolean;
	maxVotesPerVoter: number;
};
