import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth';
import { getConvexClient } from '$lib/server/convex';
import { redirectIfNotAuthed, redirectIfNotInMeeting } from '$lib/server/guards';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

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

	return {
		meeting: await convex.query(api.users.meeting.getData, { meetingId: locals.meetingId }),
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
