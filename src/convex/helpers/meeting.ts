import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import type { UserIdentity } from 'convex/server';
import { AppError, errors } from './error';
import type { Doc, Id } from '$convex/_generated/dataModel';

type Db = Pick<QueryCtx, 'db'>['db'];

export async function getSpeakerQueueEntryByOrdinal(
	db: Db,
	meetingId: Id<'meetings'>,
	ordinal: number,
) {
	return db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) => q.eq('meetingId', meetingId).eq('ordinal', ordinal))
		.first();
}

export async function closeSpeakerSessionIfOpen(
	db: MutationCtx['db'],
	entry: Doc<'speakerQueueEntries'>,
	now: number,
) {
	const sessions = entry.sessions ?? [];
	if (sessions.length === 0) return;
	const last = sessions[sessions.length - 1];
	if (last?.stopTime !== undefined) return;
	const updated = [...sessions];
	updated[updated.length - 1] = { ...last, stopTime: now };
	await db.patch('speakerQueueEntries', entry._id, { sessions: updated });
}

/** First queue entry after `afterOrdinal` whose participant is not absent. */
export async function findNextPresentSpeaker(
	db: Db,
	meetingId: Id<'meetings'>,
	afterOrdinal: number,
	take = 20,
): Promise<Doc<'speakerQueueEntries'> | null> {
	const candidates = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meetingId).gt('ordinal', afterOrdinal),
		)
		.order('asc')
		.take(take);
	for (const entry of candidates) {
		const p = await db.get('meetingParticipants', entry.userId);
		if (!p?.absentSince) return entry;
	}
	return null;
}

/** First queue entry before `beforeOrdinal` (desc order) whose participant is not absent. */
export async function findPrevPresentSpeaker(
	db: Db,
	meetingId: Id<'meetings'>,
	beforeOrdinal: number,
	take = 20,
): Promise<Doc<'speakerQueueEntries'> | null> {
	const candidates = await db
		.query('speakerQueueEntries')
		.withIndex('by_meeting_ordinal', (q) =>
			q.eq('meetingId', meetingId).lt('ordinal', beforeOrdinal),
		)
		.order('desc')
		.take(take);
	for (const entry of candidates) {
		const p = await db.get('meetingParticipants', entry.userId);
		if (!p?.absentSince) return entry;
	}
	return null;
}

export async function setNotInSpeakerQueue(
	db: MutationCtx['db'],
	userId: Id<'meetingParticipants'>,
) {
	await db.patch('meetingParticipants', userId, {
		isInSpeakerQueue: false,
	});
}

export async function setCurrentSpeaker(
	db: MutationCtx['db'],
	meetingId: Id<'meetings'>,
	entry: Doc<'speakerQueueEntries'>,
	startTime: number,
) {
	const sessions = [...(entry.sessions ?? []), { startTime }];
	await db.patch('speakerQueueEntries', entry._id, { sessions });
	await db.patch('meetings', meetingId, {
		currentSpeaker: {
			userId: entry.userId,
			name: entry.name,
			startTime,
		},
		speakerIndex: entry.ordinal,
	});
}

export async function logSpeakerSlot(
	db: MutationCtx['db'],
	meetingId: Id<'meetings'>,
	type: 'reply' | 'point_of_order' | 'speaker',
	by: { userId: Id<'meetingParticipants'>; name: string },
	startTime: number,
	endTime: number,
) {
	await db.insert('speakerLogEntries', {
		meetingId,
		type,
		userId: by.userId,
		name: by.name,
		startTime,
		endTime,
	});
}

/** Closes the user's open absence, marks them present, and decrements meeting.absent. */
export async function completeReturnToMeeting(
	db: MutationCtx['db'],
	meeting: Pick<Doc<'meetings'>, '_id' | 'absent'>,
	userId: Id<'meetingParticipants'>,
) {
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
	await db.patch('meetingParticipants', userId, { absentSince: 0 });
	await db.patch('meetings', meeting._id, {
		absent: Math.max(0, (meeting.absent ?? 0) - 1),
	});
}

export async function getReturnRequest(
	db: Db,
	meetingId: Id<'meetings'>,
	userId: Id<'meetingParticipants'>,
) {
	return db
		.query('returnRequests')
		.withIndex('by_meeting_user', (q) => q.eq('meetingId', meetingId).eq('userId', userId))
		.first();
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
