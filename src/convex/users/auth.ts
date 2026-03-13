import { authed, withMe } from '$convex/helpers/auth';
import { getMeetingByCode, getMeetingParticipant } from '$convex/helpers/meeting';
import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { pickParticipantData } from '$convex/helpers/users';
import { getParticipantCounter } from '$convex/helpers/counters';

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

		if (!p) {
			await ctx.db.insert('meetingParticipants', {
				meetingId: meeting._id,
				tokenIdentifier: ctx.user.tokenIdentifier,
				name: ctx.user.name,

				role: 'participant' as const,
				isInSpeakerQueue: false,

				absentSince: 0,
				returnRequestedAt: 0,
			});

			await getParticipantCounter(meeting._id).inc(ctx);
		}

		return meeting._id;
	});
