import type { Id } from '@lsnd/convex/_generated/dataModel';
import type { MutationCtx } from '@lsnd/convex/_generated/server';

import { getAbsentCounter, getParticipantCounter } from './counters';

/**
 * Clears roll-call state: pending return requests, marks everyone as not absent,
 * closes open absence periods, then resyncs participant/absent sharded counters.
 */
export async function resetMeetingAttendanceState(
	ctx: MutationCtx,
	meetingId: Id<'meetings'>,
	now: number,
): Promise<void> {
	const absenceRows = await ctx.db
		.query('absenceEntries')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
		.collect();

	for (const e of absenceRows) {
		if (e.endTime == null) {
			await ctx.db.patch(e._id, { endTime: now });
		}
	}

	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
		.collect();

	for (const p of participants) {
		await ctx.db.patch(p._id, {
			returnRequestedAt: 0,
			absentSince: 0,
		});
	}

	const total = participants.length;

	const pc = getParticipantCounter(meetingId);
	const ac = getAbsentCounter(meetingId);

	await Promise.all([pc.reset(ctx), ac.reset(ctx)]);
	await Promise.all([pc.add(ctx, total), ac.add(ctx, 0)]);
}
