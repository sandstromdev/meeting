import { moderator } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	closeSpeakerSessionIfOpen,
	findNextPresentSpeaker,
	findPrevPresentSpeaker,
	getSpeakerQueueEntryByOrdinal,
	logSpeakerSlot,
	setCurrentSpeaker,
	setNotInSpeakerQueue,
} from '$convex/helpers/meeting';
import { z } from 'zod';

export const getPreviousSpeakers = moderator
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

export const getPreviousSpeaker = moderator.query().public(async ({ ctx: { db, meeting } }) => {
	const speakerIndex = meeting.speakerIndex ?? -1;

	const entry = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meeting._id).lt('ordinal', speakerIndex),
		)
		.order('desc')
		.first();

	return entry;
});

export const removeFromSpeakerQueue = moderator
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

export const moveSpeakerInQueue = moderator
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

export const nextSpeaker = moderator.mutation().public(async ({ ctx }) => {
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

export const previousSpeaker = moderator.mutation().public(async ({ ctx }) => {
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

export const clearPreviousSpeakers = moderator
	.mutation()
	.public(async ({ ctx: { db, meeting } }) => {
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
