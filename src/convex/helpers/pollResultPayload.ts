import type { PollResultVisibility } from '$lib/pollResultVisibility';
import type { MajorityRule } from '$lib/polls';
import type { PollOptionTotal } from './poll';

export type PollSnapshotResultsForTiering = {
	optionTotals: PollOptionTotal[];
	winners: PollOptionTotal[];
	isTie: boolean;
	majorityRule: MajorityRule | null;
	counts: Record<string, number>;
};

export type TieredPollResultsPayload<C extends Record<string, number>> = {
	optionTotals?: PollOptionTotal[];
	winners: Array<
		| PollOptionTotal
		| (Pick<PollOptionTotal, 'optionIndex' | 'option'> & { description?: string | null })
	>;
	isTie: boolean;
	majorityRule: MajorityRule | null;
	counts?: C;
};

/** Non-privileged: `full` → all numeric fields; `winner` → outcome labels only (omit counts, optionTotals, votes). */
export function buildTieredPollResultsPayload<C extends Record<string, number>>(args: {
	results: PollSnapshotResultsForTiering & { counts: C };
	effective: PollResultVisibility;
	isPrivileged: boolean;
}): TieredPollResultsPayload<C> {
	const { results, effective, isPrivileged } = args;

	if (isPrivileged || effective === 'full') {
		return {
			optionTotals: results.optionTotals,
			winners: results.winners,
			isTie: results.isTie,
			majorityRule: results.majorityRule,
			counts: results.counts,
		};
	}

	if (effective === 'winner') {
		return {
			winners: results.winners.map((w) => ({
				optionIndex: w.optionIndex,
				option: w.option,
				description: w.description,
			})),
			isTie: results.isTie,
			majorityRule: results.majorityRule,
		};
	}

	return {
		winners: [],
		isTie: results.isTie,
		majorityRule: results.majorityRule,
	};
}
