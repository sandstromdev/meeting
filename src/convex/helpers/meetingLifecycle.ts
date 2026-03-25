import type { Doc } from '../_generated/dataModel';

/** Default used when backfilling and when reading meetings before `timezone` exists. */
export const DEFAULT_MEETING_TIMEZONE = 'Europe/Stockholm';

export type MeetingStatusLiteral = 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';

/**
 * Single source for legacy + new `status` field (see migrations/backfillMeetingLifecycle).
 * During schema widen, `status` may be missing on old documents.
 */
export function deriveMeetingStatus(
	meeting: Pick<Partial<Doc<'meetings'>>, 'status' | 'isOpen'>,
): MeetingStatusLiteral {
	const s = meeting.status;
	if (s === 'draft') {
		return 'draft';
	}
	if (s === 'scheduled') {
		return 'scheduled';
	}
	if (s === 'active') {
		return 'active';
	}
	if (s === 'closed') {
		return 'closed';
	}
	if (s === 'archived') {
		return 'archived';
	}
	return meeting.isOpen ? 'active' : 'closed';
}

export function effectiveMeetingTimezone(
	meeting: Pick<Partial<Doc<'meetings'>>, 'timezone'>,
): string {
	const t = meeting.timezone?.trim();
	return t ? t : DEFAULT_MEETING_TIMEZONE;
}
