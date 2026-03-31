import { AppError, appErrors } from '$convex/helpers/error';
import { canUserJoinMeeting } from '$convex/helpers/meetingAccess';
import { authed, withMe } from '$convex/helpers/auth';
import { getMeetingByCode, getMeetingParticipant } from '$convex/helpers/meeting';
import { touchLobbyPresence } from '$convex/helpers/lobbyPresence';
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
		const access = await canUserJoinMeeting(ctx, {
			meeting,
			userId,
			email: ctx.user.email,
		});
		AppError.assert(access.allowed, appErrors.meeting_access_denied());

		const result = await ensureParticipantInMeeting(ctx, {
			meeting,
			userId,
			name: ctx.user.name,
			role: 'participant',
		});

		AppError.assert(result.ok, appErrors.participant_banned());

		if (!meeting.isOpen) {
			await touchLobbyPresence(ctx, {
				meetingId: result.meetingId,
				userId,
				now: Date.now(),
			});
		}

		return result.meetingId;
	});

export const refreshLobbyPresence = withMe.mutation().public(async ({ ctx }) => {
	const { meeting } = ctx;
	AppError.assert(
		!meeting.isOpen,
		appErrors.bad_request({ reason: 'lobby_presence_only_before_open' }),
	);
	const now = Date.now();
	await touchLobbyPresence(ctx, {
		meetingId: meeting._id,
		userId: ctx.user.subject,
		now,
	});
	return true;
});
