import { redirectIfNotAuthed } from '$lib/server/auth';
import { redirectIfNotInMeeting } from '$lib/server/meeting-cookie';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ parent }) => {
	redirectIfNotAuthed('/sign-in');
	redirectIfNotInMeeting('/anslut');

	const data = await parent();

	if (!data.authState.isAuthenticated || !data.currentUser) {
		redirect(307, '/sign-in');
	}

	if (!data.meeting) {
		redirect(307, '/anslut');
	}

	return {
		meeting: data.meeting,
		currentUser: data.currentUser,
	};
}) satisfies LayoutServerLoad;
