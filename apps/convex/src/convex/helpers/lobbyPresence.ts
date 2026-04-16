import type { Doc, Id } from '@lsnd/convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '@lsnd/convex/_generated/server';

import { completeReturnToMeeting, markParticipantAbsentNow } from './meeting';

/** Client should heartbeat at least this often; server considers presence stale beyond this age. */
export const LOBBY_PRESENCE_TTL_MS = 25_000;

export function isLobbyPresenceFresh(
	lastSeenAt: number,
	now: number,
	ttlMs = LOBBY_PRESENCE_TTL_MS,
) {
	return now - lastSeenAt <= ttlMs;
}

export async function touchLobbyPresence(
	ctx: MutationCtx,
	args: { meetingId: Id<'meetings'>; userId: string; now: number },
): Promise<void> {
	const existing = await ctx.db
		.query('meetingLobbyPresence')
		.withIndex('by_meeting_user', (q) =>
			q.eq('meetingId', args.meetingId).eq('userId', args.userId),
		)
		.first();

	if (existing) {
		await ctx.db.patch(existing._id, { lastSeenAt: args.now });
		return;
	}

	await ctx.db.insert('meetingLobbyPresence', {
		meetingId: args.meetingId,
		userId: args.userId,
		lastSeenAt: args.now,
	});
}

export async function clearLobbyPresenceForUser(
	ctx: MutationCtx,
	args: { meetingId: Id<'meetings'>; userId: string },
): Promise<void> {
	const existing = await ctx.db
		.query('meetingLobbyPresence')
		.withIndex('by_meeting_user', (q) =>
			q.eq('meetingId', args.meetingId).eq('userId', args.userId),
		)
		.first();

	if (existing) {
		await ctx.db.delete(existing._id);
	}
}

export async function clearAllLobbyPresenceForMeeting(
	ctx: Pick<MutationCtx, 'db'>,
	meetingId: Id<'meetings'>,
): Promise<void> {
	const rows = await ctx.db
		.query('meetingLobbyPresence')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meetingId))
		.collect();

	for (const row of rows) {
		await ctx.db.delete(row._id);
	}
}

export async function getFreshLobbyUserIds(
	ctx: QueryCtx | MutationCtx,
	args: { meetingId: Id<'meetings'>; now: number; ttlMs?: number },
): Promise<Set<string>> {
	const ttl = args.ttlMs ?? LOBBY_PRESENCE_TTL_MS;
	const rows = await ctx.db
		.query('meetingLobbyPresence')
		.withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
		.collect();

	const fresh = new Set<string>();
	for (const row of rows) {
		if (isLobbyPresenceFresh(row.lastSeenAt, args.now, ttl)) {
			fresh.add(row.userId);
		}
	}
	return fresh;
}

/**
 * When the meeting opens: lobby heartbeats determine initial attendance (not reconnect gating).
 * - Fresh lobby presence → närvarande (closes absence if needed).
 * - Ej fresh (lämnade lobbyn / aldrig heartbeat) → frånvarande om de stod som närvarande.
 * - Admin/moderator → alltid närvarande-logik (oberoende av lobby).
 * Rensar lobbyrader efteråt. Stängd åtkomst: användare kan fortfarande återansluta och begära återinträde som tidigare.
 */
export async function applyLobbyAttendanceAtMeetingOpen(
	ctx: MutationCtx,
	args: {
		meeting: Pick<Doc<'meetings'>, '_id' | 'lastConsumedCt'>;
		now: number;
		ttlMs?: number;
	},
): Promise<void> {
	const { meeting, now } = args;
	const freshUserIds = await getFreshLobbyUserIds(ctx, {
		meetingId: meeting._id,
		now,
		ttlMs: args.ttlMs,
	});

	const lobbyRows = await ctx.db
		.query('meetingLobbyPresence')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
		.collect();

	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
		.collect();

	for (const p of participants) {
		if (p.banned) {
			continue;
		}

		if (p.role === 'admin' || p.role === 'moderator') {
			if (p.absentSince > 0) {
				await completeReturnToMeeting(ctx, meeting, p._id);
			} else if (p.returnRequestedAt > 0) {
				await ctx.db.patch(p._id, { returnRequestedAt: 0 });
			}
			continue;
		}

		const fresh = freshUserIds.has(p.userId);

		if (fresh) {
			if (p.absentSince > 0) {
				await completeReturnToMeeting(ctx, meeting, p._id);
			} else if (p.returnRequestedAt > 0) {
				await ctx.db.patch(p._id, { returnRequestedAt: 0 });
			}
			continue;
		}

		if (p.absentSince === 0) {
			await markParticipantAbsentNow(ctx, meeting, p._id, p, now);
		} else if (p.returnRequestedAt > 0) {
			await ctx.db.patch(p._id, { returnRequestedAt: 0 });
		}
	}

	for (const row of lobbyRows) {
		await ctx.db.delete(row._id);
	}
}
