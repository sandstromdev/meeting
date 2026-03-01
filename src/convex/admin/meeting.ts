import { admin } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	closeSpeakerSessionIfOpen,
	completeReturnToMeeting,
	findNextPresentSpeaker,
	findPrevPresentSpeaker,
	getReturnRequest,
	getSpeakerQueueEntryByOrdinal,
	logSpeakerSlot,
	setCurrentSpeaker,
	setNotInSpeakerQueue,
} from '$convex/helpers/meeting';
import { pickParticipantData } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const getPreviousSpeakers = admin
	.query()
	.input({ take: z.number().default(10) })
	.public(async ({ ctx: { db, meeting }, args }) => {
		const speakerIndex = meeting.speakerIndex ?? -1;

		const entries = await db
			.query('speakerQueueEntries')
			.withIndex('by_meeting_ordinal', (q) =>
				q
					.eq('meetingId', meeting._id)
					.lt('ordinal', meeting.currentSpeaker == null ? speakerIndex + 1 : speakerIndex),
			)
			.order('desc')
			.take(args.take);

		const ids = [...new Set(entries.map((e) => e.userId))];

		const results = await Promise.all(
			ids.map(async (id) => {
				const p = await db.get('meetingParticipants', id);
				return [id, !!p?.absentSince] as const;
			}),
		);

		const absentByUser = new Map(results);

		return entries.map((e) => ({
			userId: e.userId,
			name: e.name,
			ordinal: e.ordinal,
			sessions: e.sessions ?? [],
			isAbsent: absentByUser.get(e.userId) ?? false,
		}));
	});

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
	const entries = await ctx.db
		.query('returnRequests')
		.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
		.collect();
	return entries.map((e) => ({
		userId: e.userId,
		name: e.name,
		requestedAt: e.requestedAt,
	}));
});

export const approveReturnRequest = admin
	.mutation()
	.input({ userId: zid('meetingParticipants') })
	.public(async ({ ctx, args }) => {
		const { db, meeting } = ctx;

		const req = await getReturnRequest(db, meeting._id, args.userId);
		if (!req) {
			return false;
		}

		await completeReturnToMeeting(db, meeting, req.userId);
		await db.delete('returnRequests', req._id);
		return true;
	});

export const denyReturnRequest = admin
	.mutation()
	.input({ userId: zid('meetingParticipants') })
	.public(async ({ ctx, args }) => {
		const req = await getReturnRequest(ctx.db, ctx.meeting._id, args.userId);
		if (!req) {
			return false;
		}

		await ctx.db.delete('returnRequests', req._id);
		return true;
	});

export const removeFromSpeakerQueue = admin
	.mutation()
	.input({ ordinal: z.number() })
	.public(async ({ ctx, args }) => {
		const { speakerIndex, _id } = ctx.meeting;

		if (args.ordinal === speakerIndex) {
			throw new AppError(errors.cannot_delete_current_speaker());
		}

		const entry = await getSpeakerQueueEntryByOrdinal(ctx.db, _id, args.ordinal);

		if (!entry) {
			return;
		}

		await ctx.db.delete('speakerQueueEntries', entry._id);
		await setNotInSpeakerQueue(ctx.db, entry.userId);
	});

export const moveSpeakerInQueue = admin
	.mutation()
	.input({
		ordinal: z.number(),
		direction: z.enum(['up', 'down']),
	})
	.public(async ({ ctx, args }) => {
		const { speakerIndex, _id } = ctx.meeting;

		if (args.ordinal === speakerIndex) {
			return;
		}

		const newOrdinal = args.direction === 'up' ? args.ordinal - 1 : args.ordinal + 1;

		const entry = await getSpeakerQueueEntryByOrdinal(ctx.db, _id, args.ordinal);
		const swapEntry = await getSpeakerQueueEntryByOrdinal(ctx.db, _id, newOrdinal);

		if (!entry || !swapEntry) {
			return;
		}

		await ctx.db.patch('speakerQueueEntries', entry._id, {
			ordinal: newOrdinal,
		});
		await ctx.db.patch('speakerQueueEntries', swapEntry._id, {
			ordinal: args.ordinal,
		});
	});

export const nextSpeaker = admin.mutation().public(async ({ ctx }) => {
	const { speakerIndex, currentSpeaker, _id } = ctx.meeting;
	const now = Date.now();

	if (currentSpeaker) {
		const currentEntry = await getSpeakerQueueEntryByOrdinal(ctx.db, _id, speakerIndex);
		if (currentEntry) {
			await closeSpeakerSessionIfOpen(ctx.db, currentEntry, now);
		}
		await logSpeakerSlot(ctx.db, _id, 'speaker', currentSpeaker, currentSpeaker.startTime, now);
		await setNotInSpeakerQueue(ctx.db, currentSpeaker.userId);
	}

	const nextEntry = await findNextPresentSpeaker(ctx.db, _id, speakerIndex);
	if (!nextEntry) {
		await ctx.db.patch('meetings', _id, {
			currentSpeaker: null,
		});
		return;
	}

	await setCurrentSpeaker(ctx.db, _id, nextEntry, now);
});

export const previousSpeaker = admin.mutation().public(async ({ ctx }) => {
	const { speakerIndex, currentSpeaker, _id } = ctx.meeting;
	const now = Date.now();

	if (currentSpeaker) {
		const currentEntry = await getSpeakerQueueEntryByOrdinal(ctx.db, _id, speakerIndex);
		if (currentEntry) {
			await closeSpeakerSessionIfOpen(ctx.db, currentEntry, now);
		}
		// Don't set isInSpeakerQueue false: the current speaker goes back to the queue
	}

	const beforeOrdinal = currentSpeaker == null ? speakerIndex + 1 : speakerIndex;
	const prevEntry = await findPrevPresentSpeaker(ctx.db, _id, beforeOrdinal);
	if (!prevEntry) {
		return;
	}

	await setCurrentSpeaker(ctx.db, _id, prevEntry, now);
	await ctx.db.patch('meetingParticipants', prevEntry.userId, {
		isInSpeakerQueue: true,
	});
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

export const clearPreviousSpeakers = admin.mutation().public(async ({ ctx: { db, meeting } }) => {
	const entries = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meeting._id).lte('ordinal', meeting.speakerIndex),
		)
		.collect();

	await Promise.all(entries.map((e) => db.delete('speakerQueueEntries', e._id)));

	await db.patch('meetings', meeting._id, {
		speakerIndex: -1,
	});

	return true;
});
