import { redirectIfNotAuthed } from '$lib/server/guards';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, parent }) => {
	redirectIfNotAuthed('/sign-in');

	if (!locals.meetingId) {
		redirect(307, '/m/anslut');
	}

	const { meeting } = await parent();

	if (meeting.data?.me.role !== 'moderator') {
		redirect(307, '/m');
	}

	return {};
}) satisfies LayoutServerLoad;
