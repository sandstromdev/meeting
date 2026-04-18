import { form, getRequestEvent } from '$app/server';
import { api } from '@lsnd-mt/convex/_generated/api';
import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';
import { setMeetingCookie } from '$lib/server/meeting-cookie';
import { error, invalid, redirect } from '@sveltejs/kit';
import { ConnectFormSchema } from './schema';
import { getConvexClient } from '$lib/server/convex';

export const connectForm = form(ConnectFormSchema, async (data, issue) => {
	const event = getRequestEvent();
	const convex = getConvexClient();

	try {
		const id = await convex.mutation(api.meeting.users.auth.connect, data);

		setMeetingCookie(event.cookies, id);
	} catch (e) {
		const err = (() => {
			const convexErr = getAppError(e);
			return convexErr ? AppError.fromJSON(convexErr.toJSON()) : null;
		})();

		if (err) {
			if (err.is('participant_banned')) {
				redirect(303, '/m/anslut?error=participant_banned');
			}
			if (err.is('meeting_archived')) {
				redirect(303, `/m/anslut?error=meeting_archived&m=${encodeURIComponent(data.meetingCode)}`);
			}
			if (err.is('meeting_not_found')) {
				invalid(issue.meetingCode(err.message));
			}
			if (err.is('meeting_access_denied')) {
				redirect(
					303,
					`/m/anslut?error=meeting_access_denied&m=${encodeURIComponent(data.meetingCode)}`,
				);
			}

			invalid(err.message);
		}

		console.log(e);
		error(500);
	}

	return {
		success: true,
	};
});
