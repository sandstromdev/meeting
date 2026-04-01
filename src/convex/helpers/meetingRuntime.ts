import type { Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';

type DbReader = QueryCtx['db'] | MutationCtx['db'];

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
