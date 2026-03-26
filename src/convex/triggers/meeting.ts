import type { DataModel, Doc, Id } from '$convex/_generated/dataModel';
import type { Triggers } from 'convex-helpers/server/triggers';
import { scheduleMeetingRuntimeVersionBump } from '$convex/helpers/meetingRuntime';

/** HTTP simplified snapshot invalidation for meeting-scoped tables (polls, participation, …). */

type MeetingScopedChange =
	| {
			operation: 'insert';
			oldDoc: null;
			newDoc: { meetingId: Id<'meetings'> };
	  }
	| {
			operation: 'update';
			oldDoc: { meetingId: Id<'meetings'> };
			newDoc: { meetingId: Id<'meetings'> };
	  }
	| {
			operation: 'delete';
			oldDoc: { meetingId: Id<'meetings'> };
			newDoc: null;
	  };

function scheduleHotBumpFromMeetingScopedDoc(change: MeetingScopedChange) {
	const meetingId =
		change.operation === 'delete' ? change.oldDoc.meetingId : change.newDoc.meetingId;
	scheduleMeetingRuntimeVersionBump(meetingId, { hot: true });
}

const meetingColdFieldKeys = [
	'title',
	'status',
	'isOpen',
	'startedAt',
	'timezone',
	'date',
	'agenda',
] as const satisfies readonly (keyof Doc<'meetings'>)[];

const meetingHotFieldKeys = [
	'break',
	'reply',
	'pointOfOrder',
	'currentPollId',
] as const satisfies readonly (keyof Doc<'meetings'>)[];

function serializedMeetingSlice(doc: Doc<'meetings'>, keys: readonly (keyof Doc<'meetings'>)[]) {
	const out: Record<string, unknown> = {};
	for (const k of keys) {
		const v = doc[k];
		out[k as string] =
			k === 'agenda' || k === 'break' || k === 'reply' || k === 'pointOfOrder'
				? JSON.stringify(v)
				: v;
	}
	return JSON.stringify(out);
}

function simplifiedMeetingColdChanged(before: Doc<'meetings'>, after: Doc<'meetings'>): boolean {
	return (
		serializedMeetingSlice(before, meetingColdFieldKeys) !==
		serializedMeetingSlice(after, meetingColdFieldKeys)
	);
}

function simplifiedMeetingHotChanged(before: Doc<'meetings'>, after: Doc<'meetings'>): boolean {
	return (
		serializedMeetingSlice(before, meetingHotFieldKeys) !==
		serializedMeetingSlice(after, meetingHotFieldKeys)
	);
}

export function registerMeetingSimplifiedSnapshotTriggers(triggers: Triggers<DataModel>) {
	triggers.register('meetings', async (_ctx, change) => {
		if (change.operation === 'delete') {
			return;
		}
		if (change.operation === 'insert') {
			scheduleMeetingRuntimeVersionBump(change.newDoc._id, { cold: true, hot: true });
			return;
		}

		const cold = simplifiedMeetingColdChanged(change.oldDoc, change.newDoc);
		const hot = simplifiedMeetingHotChanged(change.oldDoc, change.newDoc);

		scheduleMeetingRuntimeVersionBump(change.newDoc._id, { cold, hot });
	});

	// Poll and participation tables: hot-only (`scheduleHotBumpFromMeetingScopedDoc`). Cold snapshot stays on `meetings` + agenda keys above.
	const pollTables = ['meetingPolls', 'meetingPollVotes', 'meetingPollResults'] as const;
	for (const table of pollTables) {
		triggers.register(table, async (_ctx, change) => {
			scheduleHotBumpFromMeetingScopedDoc(change);
		});
	}

	const participationTables = [
		'speakerQueueEntries',
		'meetingParticipants',
		'absenceEntries',
	] as const;
	for (const table of participationTables) {
		triggers.register(table, async (_ctx, change) => {
			scheduleHotBumpFromMeetingScopedDoc(change);
		});
	}
}
