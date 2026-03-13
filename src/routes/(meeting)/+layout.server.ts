import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth';
import { getConvexClient } from '$lib/server/convex';
import { redirectIfNotAuthed, redirectIfNotInMeeting } from '$lib/server/guards';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getAppError } from '$convex/helpers/error';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';

export const load = (async ({ locals, cookies }) => {
	redirectIfNotAuthed('/sign-in');
	redirectIfNotInMeeting('/anslut');

	const authState = await getAuthState(createAuth, cookies);

	if (!authState.isAuthenticated) {
		redirect(307, '/sign-in');
	}

	if (!locals.meetingId) {
		redirect(307, '/anslut');
	}

	const convex = getConvexClient();

	try {
		const data = await convex.query(api.users.meeting.getData, { meetingId: locals.meetingId });

		return {
			meeting: data,
			meetingId: data.meeting._id,
		};
	} catch (e) {
		const err = getAppError(e);

		if (err?.is('meeting_not_found') || err?.is('meeting_participant_not_found')) {
			deleteMeetingCookie();

			redirect(307, '/anslut');
		}

		console.error(e);

		error(500);
	}
}) satisfies LayoutServerLoad;
