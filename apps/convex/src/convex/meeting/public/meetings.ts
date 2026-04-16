import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { authed } from '@lsnd/convex/helpers/auth';
import { c } from '@lsnd/convex/helpers';
import { canUserJoinMeeting } from '@lsnd/convex/helpers/meetingAccess';
import { AppError, appErrors } from '@lsnd/convex/helpers/error';
import { getMeetingByCode } from '@lsnd/convex/helpers/meeting';
import { assertMeetingNotArchived } from '@lsnd/convex/helpers/meetingLifecycle';

// --- Public queries ---

export const getMeetingById = authed
	.query()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);
		if (meeting) {
			assertMeetingNotArchived(meeting);
			const access = await canUserJoinMeeting(ctx, {
				meeting,
				userId: ctx.user.subject,
				email: ctx.user.email,
			});
			AppError.assert(access.allowed, appErrors.meeting_access_denied());
		}
		return meeting;
	});

export const findByCode = c
	.query()
	.input({ meetingCode: MeetingCode })
	.public(async ({ ctx, args: { meetingCode } }) => getMeetingByCode(ctx, meetingCode));
