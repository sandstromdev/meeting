import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import type { UserIdentity, Scheduler } from 'convex/server';
import { AppError, errors } from './error';
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
	const open = openAbsences.filter((e) => e.endTime === undefined);
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
	const p = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_token_meeting', (q) =>
			q.eq('tokenIdentifier', ctx.user.tokenIdentifier).eq('meetingId', meetingId),
		)
		.first();

	if (!p) {
		throw new AppError(errors.meeting_participant_not_found(meetingId));
	}

	return p;
}

export async function getMeetingByCode(ctx: QueryCtx, meetingCode: string) {
	const m = await ctx.db
		.query('meetings')
		.withIndex('by_code', (q) => q.eq('code', meetingCode))
		.first();

	if (!m) {
		throw new AppError(errors.meeting_not_found({ meetingCode }));
	}

	return m;
}
