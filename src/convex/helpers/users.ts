import { pick } from 'convex-helpers';
import type { Doc } from '../_generated/dataModel';
import { AppError, errors } from './error';

export function pickParticipantData(doc: Doc<'meetingParticipants'>) {
	return pick(doc, ['_id', 'isAdmin', 'anonID', 'absentSince', 'isInSpeakerQueue', 'name']);
}

export type StrippedMeetingParticipant = ReturnType<typeof pickParticipantData>;

export function requireNotAbsent<T extends Pick<Doc<'meetingParticipants'>, 'absentSince'>>(
	user: T,
	action?: string,
): asserts user is T & { absentSince: 0 } {
	if (user.absentSince) {
		throw new AppError(errors.illegal_while_absent(action));
	}
}
