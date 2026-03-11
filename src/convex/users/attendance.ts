import { withMe } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import { incAbsent } from '$convex/helpers/meetingCounters';
import { completeReturnToMeeting } from '$convex/helpers/meeting';

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

	if (me.isInSpeakerQueue) {
		const lastConsumedCreationTime = meeting.lastConsumedCreationTime ?? -1;
		const entries = await db
			.query('speakerQueueEntries')
			.withIndex('by_meeting_user', (q) =>
				q
					.eq('meetingId', meeting._id)
					.eq('userId', me._id)
					.gt('_creationTime', lastConsumedCreationTime),
			)
			.collect();
		for (const entry of entries) {
			await db.delete('speakerQueueEntries', entry._id);
		}

		await db.patch('meetingParticipants', me._id, { isInSpeakerQueue: false });
	}

	await db.insert('absenceEntries', {
		meetingId: meeting._id,
		userId: me._id,
		name: me.name,
		startTime: now,
	});

	await db.patch('meetingParticipants', me._id, {
		absentSince: now,
	});

	await incAbsent(ctx, meeting._id);
});

export const requestReturnToMeeting = withMe.mutation().public(async ({ ctx }) => {
	const { db, me, meeting } = ctx;

	if (!me.absentSince) {
		return false;
	}

	if (me.role === 'admin') {
		await completeReturnToMeeting(ctx, meeting, me._id);
		return true;
	}

	if (me.returnRequestedAt) {
		return false;
	}

	const now = Date.now();
	await db.patch('meetingParticipants', me._id, { returnRequestedAt: now });
	return true;
});

export const recallReturnRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, me } = ctx;

	if (!me.returnRequestedAt) {
		return false;
	}

	await db.patch('meetingParticipants', me._id, { returnRequestedAt: 0 });
	return true;
});
