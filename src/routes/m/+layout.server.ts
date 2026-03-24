import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/helpers/error';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, cookies, url }) => {
	const authState = getAuthState();

	if (!authState.isAuthenticated) {
		redirect(307, '/sign-in');
	}

	if (!locals.meetingId) {
		redirect(307, '/m/anslut');
	}

	let meeting;

	try {
		meeting = await convexLoad(
			api.meeting.users.meeting.getData,
			{ meetingId: locals.meetingId },
			{ token: locals.token },
		);
	} catch (e) {
		const err = getAppError(e);

		if (
			err?.is('meeting_not_found') ||
			err?.is('meeting_participant_not_found') ||
			err?.is('participant_banned')
		) {
			deleteMeetingCookie(cookies);

			redirect(
				307,
				err?.is('participant_banned') ? '/m/anslut?error=participant_banned' : '/m/anslut',
			);
		}

		console.error(e);

		error(500);
	}

	if (url.pathname === '/m' && meeting.data) {
		const role = meeting.data.me.role;

		if (role === 'admin') {
			redirect(307, '/m/admin');
		}

		if (role === 'moderator') {
			redirect(307, '/m/moderator');
		}
	}

	return {
		meeting,
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
