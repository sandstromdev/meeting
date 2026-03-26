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

export async function bumpMeetingRuntimeVersions(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	{
		cold = false,
		hot = false,
	}: {
		cold?: boolean;
		hot?: boolean;
	},
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
