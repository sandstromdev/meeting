import { admin } from '$convex/helpers/auth';
import {
	getAbsentCounter,
	getBannedCounter,
	getParticipantCounter,
} from '$convex/helpers/counters';
import { completeReturnToMeeting } from '$convex/helpers/meeting';
import { ensureParticipantInMeeting } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const getParticipants = admin.query().public(async ({ ctx }) => {
	const participants = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
		.take(500);

	return participants.map((p) => ({
		_id: p._id,
		name: p.name,
		role: p.role,
		absentSince: p.absentSince,
		isInSpeakerQueue: p.isInSpeakerQueue,
		returnRequestedAt: p.returnRequestedAt,
		banned: p.banned ?? false,
	}));
});

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
			if (p.absentSince > 0) {
				return false;
			}

			const now = Date.now();

			if (p.isInSpeakerQueue) {
				const entries = await ctx.db
					.query('speakerQueueEntries')
					.withIndex('by_meeting_user', (q) =>
						q
							.eq('meetingId', ctx.meeting._id)
							.eq('userId', args.userId)
							.gt('_creationTime', ctx.meeting.lastConsumedCt ?? -1),
					)
					.collect();
				for (const entry of entries) {
					await ctx.db.delete('speakerQueueEntries', entry._id);
				}
				await ctx.db.patch('meetingParticipants', args.userId, { isInSpeakerQueue: false });
			}

			await ctx.db.insert('absenceEntries', {
				meetingId: ctx.meeting._id,
				userId: args.userId,
				name: p.name,
				startTime: now,
				endTime: null,
			});

			await ctx.db.patch('meetingParticipants', args.userId, { absentSince: now });
			await getAbsentCounter(ctx.meeting._id).inc(ctx);
		} else {
			if (p.absentSince === 0) {
				return false;
			}

			await completeReturnToMeeting(ctx, ctx.meeting, args.userId);
		}

		return true;
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
		const result = await ensureParticipantInMeeting(ctx, {
			meeting: ctx.meeting,
			userId: args.userId,
			name: args.name,
			role: args.role,
		});

		if (!result.ok) {
			return false;
		}

		return true;
	});
