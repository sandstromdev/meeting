import { withMe } from '$convex/helpers/auth';
import { logSpeakerSlot } from '$convex/helpers/meeting';
import { z } from 'zod';

export const request = withMe
	.mutation()
	.input({
		type: z.enum(['pointOfOrder', 'reply', 'break']),
	})
	.public(async ({ ctx, args }) => {
		const { meeting, me } = ctx;
		const { type } = args;

		if (meeting[type]) {
			return false;
		}

		await ctx.db.patch('meetings', meeting._id, {
			[type]: {
				type: 'requested',
				by: {
					userId: me._id,
					name: me.name,
				},
			},
		});
		return true;
	});

export const recallRequest = withMe
	.mutation()
	.input({
		type: z.enum(['pointOfOrder', 'reply', 'break']),
	})
	.public(async ({ ctx, args }) => {
		const { meeting, me } = ctx;
		const { type } = args;

		if (meeting[type]?.type !== 'requested' || meeting[type]?.by.userId !== me._id) {
			return false;
		}

		await ctx.db.patch('meetings', meeting._id, {
			[type]: null,
		});

		return true;
	});

export const getNextSpeakers = withMe.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('speakerQueueEntries')
		.withIndex('by_meeting', (q) =>
			q
				.eq('meetingId', ctx.meeting._id)
				.gt('_creationTime', ctx.meeting.lastConsumedCreationTime ?? -1),
		)
		.order('asc')
		.take(10);
});

export const placeInSpeakerQueue = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;

	if (
		me.absentSince ||
		me.isInSpeakerQueue ||
		meeting.break?.type === 'accepted' ||
		(meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id) ||
		(meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id)
	) {
		return false;
	}

	await db.insert('speakerQueueEntries', {
		meetingId: meeting._id,
		userId: me._id,
		name: me.name,
	});

	await db.patch('meetingParticipants', me._id, {
		isInSpeakerQueue: true,
	});

	return true;
});

export const recallSpeakerQueueRequest = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
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

	if (entries.length > 0) {
		await db.patch('meetingParticipants', me._id, { isInSpeakerQueue: false });
	}
});

export const doneSpeaking = withMe.mutation().public(async ({ ctx }) => {
	const { db, meeting, me } = ctx;
	const { currentSpeaker, _id } = meeting;
	const now = Date.now();

	if (meeting.reply?.type === 'accepted' && meeting.reply.by.userId === me._id) {
		await logSpeakerSlot(ctx, 'reply', meeting.reply.by, meeting.reply.startTime ?? now, now);
		await db.patch('meetings', _id, { reply: null });
		return true;
	}

	if (meeting.pointOfOrder?.type === 'accepted' && meeting.pointOfOrder.by.userId === me._id) {
		await logSpeakerSlot(
			ctx,
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

	const consumedCreationTime = currentSpeaker.creationTime;

	await logSpeakerSlot(ctx, 'speaker', currentSpeaker, currentSpeaker.startTime, now);

	await db.patch('meetingParticipants', me._id, { isInSpeakerQueue: false });

	if (consumedCreationTime !== undefined) {
		const currentEntry = await db
			.query('speakerQueueEntries')
			.withIndex('by_meeting', (q) =>
				q.eq('meetingId', _id).eq('_creationTime', consumedCreationTime),
			)
			.first();
		if (currentEntry) {
			await db.delete('speakerQueueEntries', currentEntry._id);
		}
	}

	const previousSpeaker = {
		userId: currentSpeaker.userId,
		name: currentSpeaker.name,
		startTime: currentSpeaker.startTime,
		creationTime: consumedCreationTime ?? meeting.lastConsumedCreationTime ?? -1,
	};

	const nextCursor = consumedCreationTime ?? meeting.lastConsumedCreationTime ?? -1;

	if (meeting.pointOfOrder?.type === 'accepted' || meeting.reply?.type === 'accepted') {
		await db.patch('meetings', _id, {
			previousSpeaker,
			lastConsumedCreationTime: nextCursor,
			currentSpeaker: null,
		});
		return true;
	}

	if (consumedCreationTime !== undefined) {
		await db.patch('meetings', _id, { lastConsumedCreationTime: consumedCreationTime });
	}

	const candidates = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting', (q) => q.eq('meetingId', _id).gt('_creationTime', nextCursor))
		.order('asc')
		.take(20);
	let nextEntry: (typeof candidates)[number] | null = null;
	for (const entry of candidates) {
		const participant = await db.get('meetingParticipants', entry.userId);
		if (!participant?.absentSince) {
			nextEntry = entry;
			break;
		}
	}
	if (!nextEntry) {
		await db.patch('meetings', _id, { previousSpeaker, currentSpeaker: null });
		return true;
	}

	const latestMeeting = await db.get('meetings', _id);
	if (!latestMeeting) {
		return true;
	}
	const latestPreviousSpeaker =
		latestMeeting.currentSpeaker != null
			? {
					...latestMeeting.currentSpeaker,
					creationTime:
						latestMeeting.currentSpeaker.creationTime ??
						latestMeeting.lastConsumedCreationTime ??
						-1,
				}
			: null;
	await db.patch('meetings', _id, {
		previousSpeaker: latestPreviousSpeaker,
		currentSpeaker: {
			userId: nextEntry.userId,
			name: nextEntry.name,
			startTime: now,
			creationTime: nextEntry._creationTime,
		},
	});
	return true;
});
