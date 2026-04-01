import type { DataModel, Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import { getMeetingRuntimeState } from '$convex/helpers/meetingRuntime';
import type { Triggers } from 'convex-helpers/server/triggers';

async function bumpMeetingRuntimeVersions(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	{ cold, hot }: { cold?: boolean; hot?: boolean },
) {
	if (!cold && !hot) {
		return;
	}

	const runtime = await getMeetingRuntimeState(ctx.db, meetingId);

	if (!runtime) {
		await ctx.db.insert('meetingRuntimeStates', {
			meetingId,
			simplifiedColdVersion: cold ? 1 : 0,
			simplifiedHotVersion: hot ? 1 : 0,
		});
		return;
	}

	await ctx.db.patch('meetingRuntimeStates', runtime._id, {
		...(cold ? { simplifiedColdVersion: runtime.simplifiedColdVersion + 1 } : {}),
		...(hot ? { simplifiedHotVersion: runtime.simplifiedHotVersion + 1 } : {}),
	});
}

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

async function bumpHotFromMeetingScopedDoc(ctx: MutationCtx, change: MeetingScopedChange) {
	const meetingId =
		change.operation === 'delete' ? change.oldDoc.meetingId : change.newDoc.meetingId;
	await bumpMeetingRuntimeVersions(ctx, meetingId, { hot: true });
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
	triggers.register('meetings', async (ctx, change) => {
		if (change.operation === 'delete') {
			const runtime = await getMeetingRuntimeState(ctx.db, change.oldDoc._id);
			if (runtime) {
				await ctx.db.delete('meetingRuntimeStates', runtime._id);
			}
			return;
		}

		if (change.operation === 'insert') {
			await bumpMeetingRuntimeVersions(ctx as MutationCtx, change.newDoc._id, {
				cold: true,
				hot: true,
			});
			return;
		}

		const cold = simplifiedMeetingColdChanged(change.oldDoc, change.newDoc);
		const hot = simplifiedMeetingHotChanged(change.oldDoc, change.newDoc);

		await bumpMeetingRuntimeVersions(ctx as MutationCtx, change.newDoc._id, { cold, hot });
	});

	const pollTables = ['meetingPolls', 'meetingPollVotes', 'meetingPollResults'] as const;

	for (const table of pollTables) {
		triggers.register(table, async (ctx, change) => {
			await bumpHotFromMeetingScopedDoc(ctx as MutationCtx, change);
		});
	}

	const participationTables = [
		'speakerQueueEntries',
		'meetingParticipants',
		'absenceEntries',
	] as const;

	for (const table of participationTables) {
		triggers.register(table, async (ctx, change) => {
			await bumpHotFromMeetingScopedDoc(ctx as MutationCtx, change);
		});
	}
}
