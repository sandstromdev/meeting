import { form } from '$app/server';
import { api } from '$lib/convex/_generated/api';
import { getAppError } from '$lib/convex/error';
import { setAuth } from '$lib/server/auth';
import { getConvexClient } from '$lib/server/convex';
import { error, invalid, redirect } from '@sveltejs/kit';
import { ConnectFormSchema } from './schema';

export const connectForm = form(ConnectFormSchema, async (data, issue) => {
	const convex = getConvexClient();

	try {
		const { token } = await convex.mutation(api.users.auth.createUser, data);

		await setAuth(token);
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
