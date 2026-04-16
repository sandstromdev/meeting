/** How much of a closed poll's result is visible to non-privileged viewers. */
export const POLL_RESULT_VISIBILITIES = ['none', 'winner', 'full'] as const;
export type PollResultVisibility = (typeof POLL_RESULT_VISIBILITIES)[number];

export type PollWithResultVisibilityFields = {
	resultVisibility?: PollResultVisibility;
	/** @deprecated Prefer `resultVisibility`. */
	isResultPublic?: boolean;
};

export function effectiveResultVisibility(
	poll: PollWithResultVisibilityFields,
): PollResultVisibility {
	return poll.resultVisibility ?? (poll.isResultPublic === true ? 'full' : 'none');
}

/** Prefer `resultVisibility` from edits; else map legacy `isResultPublic`; else keep stored or derive from row. */
export function resolveResultVisibilityForWrite(args: {
	stored: PollWithResultVisibilityFields;
	editsResultVisibility?: PollResultVisibility;
	editsIsResultPublic?: boolean;
}): PollResultVisibility {
	if (args.editsResultVisibility !== undefined) {
		return args.editsResultVisibility;
	}
	if (args.editsIsResultPublic !== undefined) {
		return args.editsIsResultPublic ? 'full' : 'none';
	}
	return effectiveResultVisibility(args.stored);
}

export function syncIsResultPublicFromVisibility(visibility: PollResultVisibility): boolean {
	return visibility === 'full';
}

/** For new poll rows (no stored document): prefer `resultVisibility`, else `isResultPublic`, else `none`. */
export function normalizedPollVisibilityFields(draft: {
	resultVisibility?: PollResultVisibility;
	isResultPublic?: boolean;
}): { resultVisibility: PollResultVisibility; isResultPublic: boolean } {
	let v = draft.resultVisibility;
	if (v === undefined && draft.isResultPublic !== undefined) {
		v = draft.isResultPublic ? 'full' : 'none';
	}
	if (v === undefined) {
		v = 'none';
	}
	return { resultVisibility: v, isResultPublic: v === 'full' };
}
