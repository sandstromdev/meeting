import { internal } from '$convex/_generated/api';
import { c } from '$convex/helpers';
import { admin } from '$convex/helpers/auth';
import {
	getAbsentCounter,
	getBannedCounter,
	getParticipantCounter,
} from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import { completeReturnToMeeting, logSpeakerSlot } from '$convex/helpers/meeting';
import { resetMeetingAttendanceState } from '$convex/helpers/meetingAttendanceReset';
import { pickParticipantData } from '$convex/helpers/users';
import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

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
		.collect();

	return entries.map((e) => ({
		type: e.type,
		name: e.name,
		startTime: e.startTime,
		endTime: e.endTime,
	}));
});

export const getAttendance = admin.query().public(async ({ ctx }) => {
	const [participants, absentees, banned] = await Promise.all([
		getParticipantCounter(ctx.meeting._id).count(ctx),
		getAbsentCounter(ctx.meeting._id).count(ctx),
		getBannedCounter(ctx.meeting._id).count(ctx),
	]);

	return { participants, absentees, banned };
});

export const getAbsentees = admin.query().public(async ({ ctx }) => {
	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting_absent', (q) => q.eq('meetingId', ctx.meeting._id).gt('absentSince', 0))
		.take(100);
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
		.take(100);
	return participants
		.filter((p) => p.returnRequestedAt)
		.map((p) => ({
			userId: p._id,
			name: p.name,
			requestedAt: p.returnRequestedAt,
		}));
});

// --- Public mutations ---

export const approveReturnRequest = admin
	.mutation()
	.input({ userId: zid('meetingParticipants') })
	.public(async ({ ctx, args }) => {
		const { db, meeting } = ctx;

		const p = await db.get('meetingParticipants', args.userId);
		if (!p?.returnRequestedAt) {
			return false;
		}

		await completeReturnToMeeting(ctx, meeting, args.userId);
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

export const clearPointOfOrder = admin.mutation().public(async ({ ctx }) => {
	const po = ctx.meeting.pointOfOrder;
	if (!po) {
		return false;
	}

	const now = Date.now();

	if (po.type === 'accepted') {
		await logSpeakerSlot(ctx, 'point_of_order', po.by, po.startTime ?? now, now);
	}

	await ctx.db.patch('meetings', ctx.meeting._id, {
		pointOfOrder: null,
	});

	return true;
});

export const acceptPointOfOrder = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
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

export const clearBreak = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
	if (!meeting.break) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: null,
	});

	return true;
});

export const acceptBreak = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
	if (!meeting.break) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: {
			type: 'accepted',
			by: meeting.break.by,
			startTime: meeting.break.startTime ?? Date.now(),
		},
	});

	return true;
});

export const acceptReply = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
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

export const clearReply = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
	const reply = meeting.reply;

	if (!reply) {
		return false;
	}

	const now = Date.now();

	if (reply.type === 'accepted') {
		await logSpeakerSlot(ctx, 'reply', reply.by, reply.startTime ?? now, now);
	}

	await db.patch('meetings', meeting._id, {
		reply: null,
	});

	return true;
});

/** Clears return requests, closes open absence periods, marks everyone present, resyncs counters. */
export const resetAttendanceState = admin.mutation().public(async ({ ctx }) => {
	await resetMeetingAttendanceState(ctx, ctx.meeting._id, Date.now());
	return true;
});

export const toggleMeeting = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;

	AppError.assert(
		meeting.status !== 'archived',
		appErrors.bad_request({ reason: 'cannot_toggle_archived_meeting' }),
	);

	if (meeting.isOpen) {
		const now = Date.now();

		await ctx.scheduler.runAfter(0, internal.meeting.admin.meeting.clearLobbyPresence, {
			meetingId: meeting._id,
		});

		if (meeting.currentPollId) {
			const currentPoll = await db.get('meetingPolls', meeting.currentPollId);
			if (currentPoll && currentPoll.meetingId === meeting._id && currentPoll.isOpen) {
				await db.patch('meetingPolls', currentPoll._id, {
					isOpen: false,
					closedAt: now,
					updatedAt: now,
				});
				await ctx.scheduler.runAfter(
					0,
					internal.meeting.jobs.meetingPollClose.createPollResultSnapshotAction,
					{
						pollId: currentPoll._id,
					},
				);
			}
		}

		await resetMeetingAttendanceState(ctx, meeting._id, now);

		await db.patch('meetings', meeting._id, {
			isOpen: false,
			currentPollId: null,
			status: 'closed',
		});
		return true;
	}

	const now = Date.now();
	await db.patch('meetings', meeting._id, {
		isOpen: true,
		startedAt: now,
		status: 'active',
	});
	return true;
});

type MeetingSnapshotTriggerResult =
	| { kind: 'inserted' }
	| { kind: 'skipped'; reason: 'not_open' | 'unchanged' };

/** Snapshot now: same checksum dedup as cron when open; also allowed when meeting is closed. */
export const triggerMeetingSnapshot = admin
	.mutation()
	.public(async ({ ctx }): Promise<MeetingSnapshotTriggerResult> => {
		const result: MeetingSnapshotTriggerResult = await ctx.runMutation(
			internal.meeting.jobs.snapshots.saveSnapshotIfChanged,
			{ meetingId: ctx.meeting._id, allowClosedMeeting: true },
		);
		return result;
	});

export const resetMeeting = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
	const now = Date.now();

	if (meeting.pointOfOrder?.type === 'accepted') {
		await logSpeakerSlot(
			ctx,
			'point_of_order',
			meeting.pointOfOrder.by,
			meeting.pointOfOrder.startTime ?? now,
			now,
		);
	}
	if (meeting.reply?.type === 'accepted') {
		await logSpeakerSlot(ctx, 'reply', meeting.reply.by, meeting.reply.startTime ?? now, now);
	}
	if (meeting.currentSpeaker) {
		await logSpeakerSlot(
			ctx,
			'speaker',
			meeting.currentSpeaker,
			meeting.currentSpeaker.startTime,
			now,
		);
	}

	const entries = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
		.collect();
	for (const entry of entries) {
		await db.delete('speakerQueueEntries', entry._id);
	}

	const participants = await db
		.query('meetingParticipants')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
		.collect();
	for (const p of participants) {
		if (p.isInSpeakerQueue) {
			await db.patch('meetingParticipants', p._id, { isInSpeakerQueue: false });
		}
	}

	const flat = meeting.agenda;
	const firstItemId = flat[0]?.id;

	await db.patch('meetings', meeting._id, {
		currentSpeaker: null,
		previousSpeaker: null,
		pointOfOrder: null,
		reply: null,
		break: null,
		lastConsumedCt: -1,
		currentAgendaItemId: firstItemId ?? null,
		currentPollId: null,
	});

	return true;
});

export const updateMeetingData = admin
	.mutation()
	.input({
		title: z.string().trim().min(1).optional(),
		code: MeetingCode.optional(),
		date: z.number().optional(),
	})
	.public(async ({ ctx, args }) => {
		const { db, meeting } = ctx;
		const updates: Record<string, unknown> = {};

		if (args.title !== undefined) {
			updates.title = args.title;
		}
		if (args.date !== undefined) {
			updates.date = args.date;
		}
		if (args.code !== undefined) {
			const newCode = args.code;
			if (newCode !== meeting.code) {
				const existing = await db
					.query('meetings')
					.withIndex('by_code', (q) => q.eq('code', newCode))
					.first();
				AppError.assert(existing == null, appErrors.meeting_code_already_exists(newCode));
			}
			updates.code = newCode;
		}

		if (Object.keys(updates).length === 0) {
			return true;
		}

		await db.patch('meetings', meeting._id, updates);
		return true;
	});

export const recountParticipants = admin.mutation().public(async ({ ctx }) => {
	const { db, meeting } = ctx;
	const participants = await db
		.query('meetingParticipants')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
		.collect();

	const counts = participants.reduce(
		(acc, p) => {
			if (p.absentSince > 0) {
				acc.absent++;
			}
			acc.total++;

			return acc;
		},
		{ absent: 0, total: 0 },
	);

	const pc = getParticipantCounter(meeting._id);
	const ac = getAbsentCounter(meeting._id);

	await Promise.all([pc.reset(ctx), ac.reset(ctx)]);
	await Promise.all([pc.add(ctx, counts.total), ac.add(ctx, counts.absent)]);

	return true;
});

export const clearLobbyPresence = c
	.mutation()
	.input({ meetingId: zid('meetings') })
	.internal(async ({ ctx, args }) => {
		const rows = await ctx.db
			.query('meetingLobbyPresence')
			.withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
			.collect();

		for (const row of rows) {
			await ctx.db.delete(row._id);
		}

		return true;
	});
