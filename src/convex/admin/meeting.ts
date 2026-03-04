import { admin } from '$convex/helpers/auth';
import {
	completeReturnToMeeting,
	logSpeakerSlot,
} from '$convex/helpers/meeting';
import { pickParticipantData } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';

export const getPointOfOrderEntries = admin.query().public(async ({ ctx }) => {
	const entries = await ctx.db
		.query('pointOfOrderEntries')
		.withIndex('by_meeting_endTime', (q) => q.eq('meetingId', ctx.meeting._id))
		.order('desc')
		.take(50);

	return entries.map((e) => ({
		name: e.name,
		startTime: e.startTime,
		endTime: e.endTime,
	}));
});

export const getSpeakerLogEntries = admin.query().public(async ({ ctx }) => {
	const entries = await ctx.db
		.query('speakerLogEntries')
		.withIndex('by_meeting_endTime', (q) => q.eq('meetingId', ctx.meeting._id))
		.order('desc')
		.take(100);

	return entries.map((e) => ({
		type: e.type,
		name: e.name,
		startTime: e.startTime,
		endTime: e.endTime,
	}));
});

export const getAbsentees = admin.query().public(async ({ ctx }) => {
	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting_absent', (q) => q.eq('meetingId', ctx.meeting._id).gt('absentSince', 0))
		.collect();
	return participants.map((p) => pickParticipantData(p));
});

export const getAbsenceEntries = admin.query().public(async ({ ctx }) => {
	const entries = await ctx.db
		.query('absenceEntries')
		.withIndex('by_meeting_startTime', (q) => q.eq('meetingId', ctx.meeting._id))
		.order('desc')
		.take(100);
	return entries;
});

export const getReturnRequests = admin.query().public(async ({ ctx }) => {
	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting_absent', (q) => q.eq('meetingId', ctx.meeting._id).gt('absentSince', 0))
		.collect();
	return participants
		.filter((p) => p.returnRequestedAt)
		.map((p) => ({
			userId: p._id,
			name: p.name,
			requestedAt: p.returnRequestedAt!,
		}));
});

export const approveReturnRequest = admin
	.mutation()
	.input({ userId: zid('meetingParticipants') })
	.public(async ({ ctx, args }) => {
		const { db, meeting } = ctx;

		const p = await db.get('meetingParticipants', args.userId);
		if (!p?.returnRequestedAt) {
			return false;
		}

		await completeReturnToMeeting(db, meeting, args.userId);
		return true;
	});

export const denyReturnRequest = admin
	.mutation()
	.input({ userId: zid('meetingParticipants') })
	.public(async ({ ctx, args }) => {
		const p = await ctx.db.get('meetingParticipants', args.userId);
		if (!p?.returnRequestedAt) {
			return false;
		}

		await ctx.db.patch('meetingParticipants', args.userId, { returnRequestedAt: 0 });
		return true;
	});

export const clearPointOfOrder = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	const po = meeting.pointOfOrder;
	if (!po) {
		return false;
	}

	const now = Date.now();

	if (po.type === 'accepted') {
		await logSpeakerSlot(db, meeting._id, 'point_of_order', po.by, po.startTime ?? now, now);
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: null,
	});

	return true;
});

export const acceptPointOfOrder = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	if (!meeting.pointOfOrder || meeting.pointOfOrder.type !== 'requested') {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: {
			type: 'accepted',
			by: meeting.pointOfOrder.by,
			startTime: Date.now(),
		},
	});

	return true;
});

export const clearBreak = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	if (!meeting.break) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: null,
	});

	return true;
});

export const acceptBreak = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	if (!meeting.break) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: {
			type: 'accepted',
			by: meeting.break.by,
		},
	});

	return true;
});

export const acceptReply = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	if (!meeting.reply || meeting.reply.type !== 'requested') {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		reply: {
			type: 'accepted',
			by: meeting.reply.by,
			startTime: Date.now(),
		},
	});

	return true;
});

export const clearReply = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	const reply = meeting.reply;

	if (!reply) {
		return false;
	}

	const now = Date.now();

	if (reply.type === 'accepted') {
		await logSpeakerSlot(db, meeting._id, 'reply', reply.by, reply.startTime ?? now, now);
	}

	await db.patch('meetings', meeting._id, {
		reply: null,
	});

	return true;
});
