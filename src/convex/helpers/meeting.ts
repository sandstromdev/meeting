import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import type { UserIdentity, Scheduler } from 'convex/server';
import { AppError, appErrors } from './error';
import type { Doc, Id } from '$convex/_generated/dataModel';
import { internal } from '$convex/_generated/api';
import { getAbsentCounter } from './counters';

export async function logSpeakerSlot(
	ctx: { scheduler: Scheduler; meeting: Pick<Doc<'meetings'>, '_id'> },
	type: 'reply' | 'point_of_order' | 'speaker',
	by: { userId: Id<'meetingParticipants'>; name: string },
	startTime: number,
	endTime: number,
) {
	await ctx.scheduler.runAfter(0, internal.admin.meeting.logSpeaker, {
		meetingId: ctx.meeting._id,
		type,
		by,
		startTime,
		endTime,
	});
}

/** Closes the user's open absence, marks them present, and decrements the absent counter. */
export async function completeReturnToMeeting(
	ctx: MutationCtx,
	meeting: Pick<Doc<'meetings'>, '_id'>,
	userId: Id<'meetingParticipants'>,
) {
	const { db } = ctx;
	const now = Date.now();
	const openAbsences = await db
		.query('absenceEntries')
		.withIndex('by_meeting_user', (q) => q.eq('meetingId', meeting._id).eq('userId', userId))
		.collect();
	const open = openAbsences.filter((e) => e.endTime == null);
	const toClose = [...open].toSorted((a, b) => b.startTime - a.startTime)[0];
	if (toClose) {
		await db.patch('absenceEntries', toClose._id, { endTime: now });
	}
	await db.patch('meetingParticipants', userId, { absentSince: 0, returnRequestedAt: 0 });
	await getAbsentCounter(meeting._id).dec(ctx);
}

export async function getMeetingParticipant(
	ctx: QueryCtx & { user: UserIdentity },
	meetingId: Id<'meetings'>,
) {
	const userId = ctx.user.subject;
	const p = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_user_meeting', (q) => q.eq('userId', userId).eq('meetingId', meetingId))
		.first();

	AppError.assertNotNull(p, appErrors.meeting_participant_not_found(meetingId));
	AppError.assert(!p.banned, appErrors.participant_banned());

	return p;
}

export async function getMeetingByCode(ctx: QueryCtx, meetingCode: string) {
	const m = await ctx.db
		.query('meetings')
		.withIndex('by_code', (q) => q.eq('code', meetingCode))
		.first();

	AppError.assertNotNull(m, appErrors.meeting_not_found({ meetingCode }));

	return m;
}
