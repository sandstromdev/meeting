import { pick } from 'convex-helpers';
import type { Doc } from '../_generated/dataModel';

export function pickParticipantData(doc: Doc<'meetingParticipants'>) {
	return pick(doc, ['_id', 'role', 'absentSince', 'isInSpeakerQueue', 'name']);
}

export type StrippedMeetingParticipant = ReturnType<typeof pickParticipantData>;
