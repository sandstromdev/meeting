import type { Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';

type DbReader = QueryCtx['db'] | MutationCtx['db'];

export type MeetingRuntimeBumpFlags = {
	cold?: boolean;
	hot?: boolean;
};

/** Coalesces bumps across triggers and explicit `bumpMeetingRuntimeVersions` in one mutation (flushed in the function builder). */
const scheduledRuntimeBumps = new Map<string, { cold: boolean; hot: boolean }>();

export function scheduleMeetingRuntimeVersionBump(
	meetingId: Id<'meetings'>,
	flags: MeetingRuntimeBumpFlags,
) {
	const cold = !!flags.cold;
	const hot = !!flags.hot;
	if (!cold && !hot) {
		return;
	}
	const key = meetingId as string;
	const cur = scheduledRuntimeBumps.get(key) ?? { cold: false, hot: false };
	scheduledRuntimeBumps.set(key, { cold: cur.cold || cold, hot: cur.hot || hot });
}

export function resetScheduledMeetingRuntimeBumps() {
	scheduledRuntimeBumps.clear();
}

export async function flushMeetingRuntimeVersionBumps(ctx: MutationCtx) {
	if (scheduledRuntimeBumps.size === 0) {
		return;
	}
	const pending = [...scheduledRuntimeBumps.entries()];
	scheduledRuntimeBumps.clear();

	for (const [meetingIdKey, flags] of pending) {
		await applyMeetingRuntimeVersionBumps(ctx, meetingIdKey as Id<'meetings'>, flags);
	}
}

async function applyMeetingRuntimeVersionBumps(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	{ cold, hot }: { cold: boolean; hot: boolean },
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

export async function getMeetingRuntimeState(db: DbReader, meetingId: Id<'meetings'>) {
	return await db
		.query('meetingRuntimeStates')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
		.unique();
}

export async function getMeetingRuntimeVersions(db: DbReader, meetingId: Id<'meetings'>) {
	const runtime = await getMeetingRuntimeState(db, meetingId);

	return {
		simplifiedColdVersion: runtime?.simplifiedColdVersion ?? 0,
		simplifiedHotVersion: runtime?.simplifiedHotVersion ?? 0,
	};
}

export async function createMeetingRuntimeState(ctx: MutationCtx, meetingId: Id<'meetings'>) {
	return await ctx.db.insert('meetingRuntimeStates', {
		meetingId,
		simplifiedColdVersion: 0,
		simplifiedHotVersion: 0,
	});
}

/** Schedules a version bump; applied once per mutation via `flushMeetingRuntimeVersionBumps`. */
export function bumpMeetingRuntimeVersions(
	_ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	flags: MeetingRuntimeBumpFlags,
) {
	scheduleMeetingRuntimeVersionBump(meetingId, flags);
}
