import type { Doc } from '../_generated/dataModel';
import { appErrors } from './error';

/** Blocks participant flows (connect, meeting room, cookie session) for archived meetings. */
export function assertMeetingNotArchived(
	meeting: Doc<'meetings'>,
	args?: { meetingCode?: string },
): void {
	if (meeting.status !== 'archived') {
		return;
	}
	const meetingCode = args?.meetingCode ?? meeting.code;
	throw appErrors.meeting_archived({ meetingId: meeting._id, meetingCode });
}
