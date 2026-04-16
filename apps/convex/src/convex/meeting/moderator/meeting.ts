import { moderator } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import { logSpeakerSlot } from '$convex/helpers/meeting';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

export const getPreviousSpeakers = moderator
	.query()
	.input({ take: z.number().default(10) })
	.public(async ({ ctx: { db, meeting }, args }) => {
		const entries = await db
			.query('speakerLogEntries')
			.withIndex('by_meeting_endTime', (q) => q.eq('meetingId', meeting._id))
			.order('desc')
			.take(args.take * 3);

		return entries
			.map((e) => ({
				type: e.type,
				userId: e.userId,
				name: e.name,
				startTime: e.startTime,
				endTime: e.endTime,
			}))
			.filter((e) => e.type === 'speaker' && e.userId != null)
			.slice(0, args.take);
	});

export const getPreviousSpeaker = moderator.query().public(async ({ ctx: { meeting } }) => {
	return meeting.previousSpeaker ?? null;
});

// --- Public mutations ---

export const removeFromSpeakerQueue = moderator
	.mutation()
	.input({ entryId: zid('speakerQueueEntries') })
	.public(async ({ ctx, args }) => {
		const { meeting } = ctx;

		const entry = await ctx.db.get('speakerQueueEntries', args.entryId);

		if (!entry || entry.meetingId !== meeting._id) {
			return;
		}

		AppError.assert(
			entry._id !== meeting.currentSpeaker?.entryId,
			appErrors.cannot_delete_current_speaker(),
		);

		await ctx.db.delete('speakerQueueEntries', entry._id);

		const stillQueued = await ctx.db
			.query('speakerQueueEntries')
			.withIndex('by_meeting_user', (q) =>
				q
					.eq('meetingId', meeting._id)
					.eq('userId', entry.userId)
					.gt('_creationTime', meeting.lastConsumedCt ?? -1),
			)
			.first();

		if (!stillQueued) {
			await ctx.db.patch('meetingParticipants', entry.userId, { isInSpeakerQueue: false });
		}
	});

export const nextSpeaker = moderator.mutation().public(async ({ ctx }) => {
	const { currentSpeaker, _id } = ctx.meeting;
	const now = Date.now();

	let previousSpeaker = ctx.meeting.previousSpeaker;

	if (currentSpeaker) {
		await logSpeakerSlot(ctx, 'speaker', currentSpeaker, currentSpeaker.startTime, now);

		await ctx.db.patch('meetingParticipants', currentSpeaker.userId, { isInSpeakerQueue: false });

		if (currentSpeaker.entryId) {
			await ctx.db.delete('speakerQueueEntries', currentSpeaker.entryId);
		}

		previousSpeaker = {
			ct: currentSpeaker.ct,
			userId: currentSpeaker.userId,
			name: currentSpeaker.name,
			startTime: currentSpeaker.startTime,
		};
	}

	const cursor = currentSpeaker?.ct ?? ctx.meeting.lastConsumedCt ?? -1;

	const candidates = await ctx.db
		.query('speakerQueueEntries')
		.withIndex('by_meeting', (q) => q.eq('meetingId', _id).gt('_creationTime', cursor))
		.order('asc')
		.take(20);

	let nextEntry: (typeof candidates)[number] | null = null;

	for (const entry of candidates) {
		const participant = await ctx.db.get('meetingParticipants', entry.userId);

		if (!participant?.absentSince) {
			nextEntry = entry;
			break;
		}
	}

	if (!nextEntry) {
		await ctx.db.patch('meetings', _id, {
			previousSpeaker,
			currentSpeaker: null,
		});

		return;
	}

	await ctx.db.patch('meetings', _id, {
		previousSpeaker,
		currentSpeaker: {
			ct: nextEntry._creationTime,
			entryId: nextEntry._id,
			userId: nextEntry.userId,
			name: nextEntry.name,
			startTime: now,
		},
		lastConsumedCt: nextEntry._creationTime,
	});
});

export const previousSpeaker = moderator.mutation().public(async ({ ctx }) => {
	const { previousSpeaker: prev, _id } = ctx.meeting;

	if (ctx.meeting.currentSpeaker) {
		await logSpeakerSlot(
			ctx,
			'speaker',
			ctx.meeting.currentSpeaker,
			ctx.meeting.currentSpeaker.startTime,
			Date.now(),
		);
	}

	if (!prev) {
		return;
	}

	await ctx.db.patch('meetings', _id, {
		currentSpeaker: {
			ct: prev.ct,
			userId: prev.userId,
			name: prev.name,
			startTime: Date.now(),
			entryId: null,
		},
		lastConsumedCt: prev.ct,
		previousSpeaker: null,
	});
});

export const clearPreviousSpeakers = moderator
	.mutation()
	.public(async ({ ctx: { db, meeting } }) => {
		await db.patch('meetings', meeting._id, {
			currentSpeaker: null,
			lastConsumedCt: -1,
			previousSpeaker: null,
		});

		return true;
	});
