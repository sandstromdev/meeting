import { ABSTAIN_OPTION_LABEL } from './pollConstants';

/** One poll alternative as stored in Convex and used in the UI API. */
export type PollOptionRow = {
	title: string;
	description: string | null;
};

/** `options` column on poll tables (`PollOptionRow[]`). */
export type StoredPollOptions = readonly PollOptionRow[];

export function normalizePollDescription(raw: string | null | undefined): string | null {
	if (raw == null) {
		return null;
	}
	const t = raw.trim();
	return t === '' ? null : t;
}

/** Normalize descriptions on stored rows (idempotent for already-normalized data). */
export function normalizeOneStoredPollOption(x: PollOptionRow): PollOptionRow {
	return {
		title: x.title,
		description: normalizePollDescription(x.description),
	};
}

export function normalizeStoredPollOptions(options: StoredPollOptions): PollOptionRow[] {
	return options.map(normalizeOneStoredPollOption);
}

export function pollOptionTitles(options: StoredPollOptions): string[] {
	return normalizeStoredPollOptions(options).map((o) => o.title);
}

/**
 * Draft options without the synthetic abstain row. Ensures the last row is not the abstain label
 * when `allowsAbstain` was stored as a trailing option.
 */
export function draftOptionsFromStored(
	stored: StoredPollOptions,
	allowsAbstain: boolean,
): PollOptionRow[] {
	const rows = normalizeStoredPollOptions(stored);
	if (allowsAbstain && rows.length > 0) {
		const last = rows[rows.length - 1];
		if (last.title === ABSTAIN_OPTION_LABEL) {
			return rows.slice(0, -1);
		}
	}
	return rows;
}

/** Append abstain as the last option when enabled. */
export function optionsWithAbstainLastRows(
	rows: PollOptionRow[],
	allowsAbstain: boolean,
): PollOptionRow[] {
	const without = rows.filter((r) => r.title !== ABSTAIN_OPTION_LABEL);
	return allowsAbstain ? [...without, { title: ABSTAIN_OPTION_LABEL, description: null }] : without;
}
