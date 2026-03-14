import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth';
import { getAppError } from '$convex/helpers/error';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, cookies }) => {
	const authState = await getAuthState(createAuth, cookies);

	if (!authState.isAuthenticated) {
		redirect(307, '/sign-in');
	}

	if (!locals.meetingId) {
		redirect(307, '/anslut');
	}

	try {
		return {
			meeting: await convexLoad(
				api.users.meeting.getData,
				{ meetingId: locals.meetingId },
				{ token: locals.token },
			),
			meetingId: locals.meetingId,
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
