import { form, getRequestEvent } from '$app/server';
import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/helpers/error';
import { setMeetingCookie } from '$lib/server/meeting-cookie';
import { error, invalid, redirect } from '@sveltejs/kit';
import { ConnectFormSchema } from './schema';
import { getConvexClient } from '$lib/server/convex';

export const connectForm = form(ConnectFormSchema, async (data, issue) => {
	const event = getRequestEvent();
	const convex = getConvexClient();

	try {
		const id = await convex.mutation(api.users.auth.connect, data);

		setMeetingCookie(event.cookies, id);
	} catch (e) {
		const err = getAppError(e);

		if (err) {
			if (err.is('participant_banned')) {
				redirect(303, '/m/anslut?error=participant_banned');
			}
			if (err.is('meeting_not_found')) {
				invalid(issue.meetingCode(err.message));
			}

			invalid(err.message);
		}

		console.log(e);
		error(500);
	}

	redirect(303, '/m');
});
