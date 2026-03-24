import { AppError, appErrors } from '$convex/helpers/error';
import { authed, withMe } from '$convex/helpers/auth';
import { getMeetingByCode, getMeetingParticipant } from '$convex/helpers/meeting';
import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { ensureParticipantInMeeting, pickParticipantData } from '$convex/helpers/users';

// --- Public queries ---

export const getUserData = withMe
	.input({ meetingId: zid('meetings') })
	.query()
	.public(async ({ ctx, args }) => {
		return pickParticipantData(await getMeetingParticipant(ctx, args.meetingId));
	});

// --- Public mutations ---

export const connect = authed
	.mutation()
	.input({
		meetingCode: MeetingCode,
	})
	.public(async ({ ctx, args }) => {
		const meeting = await getMeetingByCode(ctx, args.meetingCode);

		AppError.assertNotNull(meeting, appErrors.meeting_not_found({ meetingCode: args.meetingCode }));

		const userId = ctx.user.subject;

		const result = await ensureParticipantInMeeting(ctx, {
			meeting,
			userId,
			name: ctx.user.name,
			role: 'participant',
		});

		AppError.assert(result.ok, appErrors.participant_banned());

		return result.meetingId;
	});
