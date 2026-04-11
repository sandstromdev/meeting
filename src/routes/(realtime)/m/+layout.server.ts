import {
	loadMeetingWithConvexLoad,
	redirectNonParticipantsFromPaths,
} from '$lib/server/meeting-route-guards';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';
import { api } from '$convex/_generated/api';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ locals, cookies, url }) => {
	const meeting = await loadMeetingWithConvexLoad({ locals, cookies });

	redirectNonParticipantsFromPaths(url, meeting.data?.me);

	if (!locals.meetingId) {
		redirect(307, '/m/anslut');
	}

	const attendance = await convexLoad(
		api.meeting.admin.meeting.getAttendance,
		{ meetingId: locals.meetingId },
		{ token: locals.token },
	);

	return {
		meeting,
		attendance,
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
