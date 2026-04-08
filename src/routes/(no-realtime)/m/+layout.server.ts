import {
	loadMeetingWithConvexLoad,
	redirectNonParticipantsFromPaths,
} from '$lib/server/meeting-route-guards';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ route, locals, cookies, url }) => {
	if (route.id === '/(no-realtime)/m/anslut') {
		return {
			meetingId: locals.meetingId,
		};
	}

	const { data: meetingPayload } = await loadMeetingWithConvexLoad({ locals, cookies });

	if (!meetingPayload) {
		error(404);
	}

	redirectNonParticipantsFromPaths(url, meetingPayload.me);

	return {
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
