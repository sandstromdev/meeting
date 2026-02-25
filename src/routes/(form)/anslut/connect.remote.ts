import { form } from '$app/server';
import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/error';
import { getConvexClient } from '$lib/server/convex';
import { setMeetingCookie } from '$lib/server/meeting-cookie';
import { error, invalid, redirect } from '@sveltejs/kit';
import { ConnectFormSchema } from './schema';

export const connectForm = form(ConnectFormSchema, async (data, issue) => {
	const convex = getConvexClient();

	try {
		const { _id } = await convex.query(api.meetings.getMeeting, data);

		setMeetingCookie(_id);
	} catch (e) {
		const err = getAppError(e);

		if (err) {
			if (err.is('meeting_not_found')) {
				invalid(issue.meetingCode(err.message));
			}

			invalid(err.message);
		}

		console.log(e);
		error(500);
	}

	redirect(303, '/');
});
