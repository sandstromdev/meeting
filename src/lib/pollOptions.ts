import { ABSTAIN_OPTION_LABEL } from './pollConstants';

/** One poll alternative as stored after migration (and as used in the UI API). */
export type PollOptionRow = {
	title: string;
	description: string | null;
};

/** Legacy rows used `string[]`; new rows use `PollOptionRow[]`. */
export type StoredPollOptions = readonly (string | PollOptionRow)[];

export function normalizePollDescription(raw: string | null | undefined): string | null {
	if (raw == null) {
		return null;
	}
	const t = raw.trim();
	return t === '' ? null : t;
}

export function isPollOptionRow(x: string | PollOptionRow): x is PollOptionRow {
	return typeof x === 'object' && x !== null && 'title' in x;
}

/** Normalize one stored entry to a row (legacy string or new object). */
export function normalizeOneStoredPollOption(x: string | PollOptionRow): PollOptionRow {
	if (isPollOptionRow(x)) {
		return {
			title: x.title,
			description: normalizePollDescription(x.description),
		};
	}
	return { title: x, description: null };
}

export function normalizeStoredPollOptions(options: StoredPollOptions): PollOptionRow[] {
	return options.map(normalizeOneStoredPollOption);
}

export function pollOptionTitles(options: StoredPollOptions): string[] {
	return normalizeStoredPollOptions(options).map((o) => o.title);
}

/** `true` when every element is a string (legacy Convex shape). */
export function isLegacyStringPollOptions(options: StoredPollOptions): boolean {
	return options.length > 0 && options.every((x) => typeof x === 'string');
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
