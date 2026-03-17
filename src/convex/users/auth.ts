import { authed, withMe } from '$convex/helpers/auth';
import { getMeetingByCode, getMeetingParticipant } from '$convex/helpers/meeting';
import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { pickParticipantData } from '$convex/helpers/users';
import { getAbsentCounter, getParticipantCounter } from '$convex/helpers/counters';

export const getUserData = withMe
	.input({ meetingId: zid('meetings') })
	.query()
	.public(async ({ ctx, args }) => {
		return pickParticipantData(await getMeetingParticipant(ctx, args.meetingId));
	});

export const connect = authed
	.mutation()
	.input({
		meetingCode: MeetingCode,
	})
	.public(async ({ ctx, args }) => {
		const meeting = await getMeetingByCode(ctx, args.meetingCode);

		const p = await ctx.db
			.query('meetingParticipants')
			.withIndex('by_token_meeting', (q) =>
				q.eq('tokenIdentifier', ctx.user.tokenIdentifier).eq('meetingId', meeting._id),
			)
			.first();

		const now = Date.now();

		if (!p) {
			const id = await ctx.db.insert('meetingParticipants', {
				meetingId: meeting._id,
				tokenIdentifier: ctx.user.tokenIdentifier,
				name: ctx.user.name,

				role: 'participant' as const,
				isInSpeakerQueue: false,

				absentSince: meeting.isOpen ? now : 0,
				returnRequestedAt: 0,
			});

			await getParticipantCounter(meeting._id).inc(ctx);

			if (meeting.isOpen) {
				await getAbsentCounter(meeting._id).inc(ctx);
				await ctx.db.insert('absenceEntries', {
					meetingId: meeting._id,
					userId: id,
					name: ctx.user.name,
					startTime: now,
				});
			}
		}

		if (p && p.absentSince > 0 && p.role !== 'admin') {
			await ctx.db.patch('meetingParticipants', p._id, { returnRequestedAt: now });
		}

		return meeting._id;
	});
