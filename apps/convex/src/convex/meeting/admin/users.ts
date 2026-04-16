import { authComponent } from '$convex/auth';
import { admin } from '$convex/helpers/auth';
import {
	getAbsentCounter,
	getBannedCounter,
	getParticipantCounter,
} from '$convex/helpers/counters';
import { grantMeetingAccess, revokeMeetingAccess } from '$convex/helpers/meetingAccess';
import { completeReturnToMeeting, markParticipantAbsentNow } from '$convex/helpers/meeting';
import { ensureParticipantInMeeting } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { paginationOptsValidator } from '$convex/helpers/pagination';

// --- Public queries ---

export const getParticipants = admin
	.query()
	.input({
		pagination: paginationOptsValidator,
	})
	.public(async ({ ctx, args }) => {
		const participants = await ctx.db
			.query('meetingParticipants')
			.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
			.paginate(args.pagination);

		return {
			...participants,
			page: participants.page.map((p) => ({
				_id: p._id,
				name: p.name,
				role: p.role,
				userId: p.userId,
				joinedAt: p.joinedAt ?? p._creationTime,
				absentSince: p.absentSince,
				isInSpeakerQueue: p.isInSpeakerQueue,
				returnRequestedAt: p.returnRequestedAt,
				banned: p.banned ?? false,
			})),
		};
	});

export const getParticipantEmail = admin
	.query()
	.input({
		userId: z.string('user'),
	})
	.public(async ({ ctx, args }) => {
		const user = await authComponent.getAnyUserById(ctx, args.userId);

		if (!user) {
			return null;
		}

		return user.email;
	});

// --- Public mutations ---

export const setParticipantRole = admin
	.mutation()
	.input({
		userId: zid('meetingParticipants'),
		role: z.enum(['admin', 'moderator', 'participant', 'adjuster']),
	})
	.public(async ({ ctx, args }) => {
		const p = await ctx.db.get('meetingParticipants', args.userId);
		if (!p || p.meetingId !== ctx.meeting._id) {
			return false;
		}

		if (p._id === ctx.me._id) {
			return false;
		}

		await ctx.db.patch('meetingParticipants', args.userId, { role: args.role });
		return true;
	});

export const setParticipantAbsent = admin
	.mutation()
	.input({
		userId: zid('meetingParticipants'),
		absent: z.boolean(),
	})
	.public(async ({ ctx, args }) => {
		const p = await ctx.db.get('meetingParticipants', args.userId);
		if (!p || p.meetingId !== ctx.meeting._id) {
			return false;
		}

		if (args.absent) {
			const now = Date.now();
			return await markParticipantAbsentNow(ctx, ctx.meeting, args.userId, p, now);
		}

		if (p.absentSince === 0) {
			return false;
		}

		await completeReturnToMeeting(ctx, ctx.meeting, args.userId);

		return true;
	});

export const markAllPresentParticipantsAbsent = admin
	.mutation()
	.input({
		skipNonParticipants: z.boolean(),
	})
	.public(async ({ ctx, args }) => {
		const participants = await ctx.db
			.query('meetingParticipants')
			.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
			.collect();

		const now = Date.now();
		let marked = 0;
		for (const p of participants) {
			if (p._id === ctx.me._id) {
				continue;
			}
			if (args.skipNonParticipants && p.role !== 'participant') {
				continue;
			}
			if (await markParticipantAbsentNow(ctx, ctx.meeting, p._id, p, now)) {
				marked++;
			}
		}

		return { marked };
	});

export const removeParticipant = admin
	.mutation()
	.input({
		userId: zid('meetingParticipants'),
	})
	.public(async ({ ctx, args }) => {
		if (args.userId === ctx.me._id) {
			return false;
		}

		const p = await ctx.db.get('meetingParticipants', args.userId);
		if (!p || p.meetingId !== ctx.meeting._id) {
			return false;
		}
		const authUser = await authComponent.getAnyUserById(ctx, p.userId);

		// Remove from speaker queue entries (if any)
		const entries = await ctx.db
			.query('speakerQueueEntries')
			.withIndex('by_meeting_user', (q) =>
				q.eq('meetingId', ctx.meeting._id).eq('userId', args.userId),
			)
			.take(200);
		for (const entry of entries) {
			await ctx.db.delete('speakerQueueEntries', entry._id);
		}

		// Clear meeting state that might reference this participant
		const meetingUpdates: Record<string, unknown> = {};

		if (ctx.meeting.currentSpeaker?.userId === args.userId) {
			meetingUpdates.currentSpeaker = null;
		}
		if (ctx.meeting.previousSpeaker?.userId === args.userId) {
			meetingUpdates.previousSpeaker = null;
		}
		if (ctx.meeting.break?.by.userId === args.userId) {
			meetingUpdates.break = null;
		}
		if (ctx.meeting.pointOfOrder?.by.userId === args.userId) {
			meetingUpdates.pointOfOrder = null;
		}
		if (ctx.meeting.reply?.by.userId === args.userId) {
			meetingUpdates.reply = null;
		}

		if (Object.keys(meetingUpdates).length > 0) {
			await ctx.db.patch('meetings', ctx.meeting._id, meetingUpdates);
		}

		// Update counters
		await getParticipantCounter(ctx.meeting._id).dec(ctx);

		if (p.absentSince > 0) {
			await getAbsentCounter(ctx.meeting._id).dec(ctx);
		}

		if (p.banned ?? false) {
			await getBannedCounter(ctx.meeting._id).dec(ctx);
		}

		await revokeMeetingAccess(ctx, {
			meetingId: ctx.meeting._id,
			userId: p.userId,
			email: authUser?.email,
		});
		await ctx.db.delete('meetingParticipants', args.userId);

		return true;
	});

export const setParticipantBanned = admin
	.mutation()
	.input({
		userId: zid('meetingParticipants'),
		banned: z.boolean(),
	})
	.public(async ({ ctx, args }) => {
		if (args.userId === ctx.me._id) {
			return false;
		}

		const p = await ctx.db.get('meetingParticipants', args.userId);
		if (!p || p.meetingId !== ctx.meeting._id) {
			return false;
		}

		const currentlyBanned = p.banned ?? false;
		if (currentlyBanned !== args.banned) {
			if (args.banned) {
				await getBannedCounter(ctx.meeting._id).inc(ctx);
			} else {
				await getBannedCounter(ctx.meeting._id).dec(ctx);
			}
		}

		await ctx.db.patch('meetingParticipants', args.userId, { banned: args.banned });
		return true;
	});

export const addParticipant = admin
	.mutation()
	.input({
		userId: z.string(),
		name: z.string(),
		role: z.enum(['admin', 'moderator', 'participant', 'adjuster']),
	})
	.public(async ({ ctx, args }) => {
		const authUser = await authComponent.getAnyUserById(ctx, args.userId);
		await grantMeetingAccess(ctx, {
			meetingId: ctx.meeting._id,
			userId: args.userId,
			email: authUser?.email,
			addedByUserId: ctx.user.subject,
		});

		const result = await ensureParticipantInMeeting(ctx, {
			meeting: ctx.meeting,
			userId: args.userId,
			name: args.name,
			role: args.role,
			requestReturnIfAbsent: false,
			syncExistingName: true,
			syncExistingRole: true,
		});

		if (!result.ok) {
			return false;
		}

		return true;
	});
