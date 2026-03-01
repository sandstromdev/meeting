import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	closeSpeakerSessionIfOpen,
	completeReturnToMeeting,
	findNextPresentSpeaker,
	getReturnRequest,
	getSpeakerQueueEntryByOrdinal,
	logSpeakerSlot,
	setCurrentSpeaker,
	setNotInSpeakerQueue,
} from '$convex/helpers/meeting';

export const getData = withMe.query().public(async ({ ctx }) => {
	const { me, meeting } = ctx;

	const speakerIndex = meeting.speakerIndex ?? -1;

	const nextSpeakersRaw = await ctx.db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meeting._id).gt('ordinal', speakerIndex),
		)
		.order('asc')
		.take(10);

	const participantIds = [...new Set(nextSpeakersRaw.map((e) => e.userId))];
	const participants = await Promise.all(
		participantIds.map((id) => ctx.db.get('meetingParticipants', id)),
	);
	const absentByUser = new Map(participantIds.map((id, i) => [id, !!participants[i]?.absentSince]));

	const pendingReturn = await getReturnRequest(ctx.db, meeting._id, me._id);

	return {
		meeting,
		me,
		nextSpeakers: nextSpeakersRaw.map((e) => ({
			userId: e.userId,
			name: e.name,
			ordinal: e.ordinal,
			isAbsent: absentByUser.get(e.userId) ?? false,
		})),
		hasPendingReturnRequest: !!pendingReturn,
	};
});

export const placeInSpeakerQueue = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	if (
		me.absentSince ||
		me.isInSpeakerQueue ||
		meeting.break?.type === 'accepted' ||
		meeting.pointOfOrder?.type === 'accepted' ||
		meeting.reply?.type === 'accepted'
	) {
		return false;
	}

	const maxOrdinal = meeting.maxOrdinal ?? -1;
	const ordinal = maxOrdinal + 1;

	await db.insert('speakerQueueEntries', {
		meetingId: meeting._id,
		ordinal,
		userId: me._id,
		name: me.name,
		sessions: [],
	});

	await db.patch('meetings', meeting._id, {
		maxOrdinal: ordinal,
	});

	await db.patch('meetingParticipants', me._id, {
		isInSpeakerQueue: true,
	});

	return true;
});

export const recallSpeakerQueueRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	const speakerIndex = meeting.speakerIndex ?? -1;

	const entries = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_user_ordinal', (q) =>
			q.eq('meetingId', meeting._id).eq('userId', me._id).gt('ordinal', speakerIndex),
		)
		.collect();

	for (const entry of entries) {
		await db.delete('speakerQueueEntries', entry._id);
	}

	if (entries.length > 0) {
		await setNotInSpeakerQueue(db, me._id);
	}
});

export const doneSpeaking = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	const { speakerIndex, currentSpeaker, _id } = meeting;
	const now = Date.now();

	if (meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id) {
		await logSpeakerSlot(db, _id, 'reply', meeting.reply.by, meeting.reply.startTime ?? now, now);
		await db.patch('meetings', _id, { reply: null });
		return true;
	}

	if (meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id) {
		await logSpeakerSlot(
			db,
			_id,
			'point_of_order',
			meeting.pointOfOrder.by,
			meeting.pointOfOrder.startTime ?? now,
			now,
		);
		await db.patch('meetings', _id, { pointOfOrder: null });
		return true;
	}

	if (currentSpeaker?.userId !== me._id) {
		return false;
	}

	const currentEntry = await getSpeakerQueueEntryByOrdinal(db, _id, speakerIndex);
	if (currentEntry) {
		await closeSpeakerSessionIfOpen(db, currentEntry, now);
	}

	await logSpeakerSlot(db, _id, 'speaker', currentSpeaker, currentSpeaker.startTime, now);
	await setNotInSpeakerQueue(db, currentSpeaker.userId);

	if (meeting.pointOfOrder?.type === 'accepted' || meeting.reply?.type === 'accepted') {
		await db.patch('meetings', _id, {
			currentSpeaker: null,
		});
		return true;
	}

	const nextEntry = await findNextPresentSpeaker(db, _id, speakerIndex);
	if (!nextEntry) {
		await db.patch('meetings', _id, { currentSpeaker: null });
		return true;
	}

	await setCurrentSpeaker(db, _id, nextEntry, now);
	return true;
});

export const requestPointOfOrder = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.pointOfOrder) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: {
			type: 'requested',
			by: {
				userId: me._id,
				name: me.name,
			},
		},
	});

	return true;
});

export const recallPointOfOrderRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.pointOfOrder?.type !== 'requested' || meeting.pointOfOrder.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		pointOfOrder: null,
	});

	return true;
});

export const requestReply = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.reply) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		reply: {
			type: 'requested',
			by: {
				userId: me._id,
				name: me.name,
			},
		},
	});

	return true;
});

export const recallReplyRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.reply?.type !== 'requested' || meeting.reply.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		reply: null,
	});

	return true;
});

export const requestBreak = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.break) {
		return;
	}

	await db.patch('meetings', meeting._id, {
		break: {
			type: 'requested',
			by: {
				userId: me._id,
				name: me.name,
			},
		},
	});
});

export const recallBreakRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (meeting.break?.type !== 'requested' || meeting.break.by.userId !== me._id) {
		return false;
	}

	await db.patch('meetings', meeting._id, {
		break: null,
	});

	return true;
});

export const leaveMeeting = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	if (me.absentSince) {
		return;
	}

	const isCurrentSpeaker = meeting.currentSpeaker?.userId === me._id;
	const isPointOfOrderSpeaker =
		meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id;
	const isReplySpeaker = meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id;

	if (isCurrentSpeaker || isPointOfOrderSpeaker || isReplySpeaker) {
		throw new AppError(errors.cannot_leave_while_speaking());
	}

	const now = Date.now();

	await db.insert('absenceEntries', {
		meetingId: meeting._id,
		userId: me._id,
		name: me.name,
		startTime: now,
	});

	await db.patch('meetingParticipants', me._id, {
		absentSince: now,
	});

	await db.patch('meetings', meeting._id, {
		absent: (meeting.absent ?? 0) + 1,
	});
});

export const requestReturnToMeeting = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	if (!me.absentSince) {
		return false;
	}

	if (me.isAdmin) {
		await completeReturnToMeeting(db, meeting, me._id);
		return true;
	}

	const existing = await getReturnRequest(db, meeting._id, me._id);
	if (existing) {
		return false;
	}

	const now = Date.now();

	await db.insert('returnRequests', {
		meetingId: meeting._id,
		userId: me._id,
		name: me.name,
		requestedAt: now,
	});

	return true;
});

export const recallReturnRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	const existing = await getReturnRequest(db, meeting._id, me._id);
	if (!existing) {
		return false;
	}

	await db.delete('returnRequests', existing._id);
	return true;
});
