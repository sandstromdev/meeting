import {
	loadMeetingWithConvexLoad,
	redirectNonParticipantsFromPaths,
} from '$lib/server/meeting-route-guards';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, cookies, url }) => {
	const meeting = await loadMeetingWithConvexLoad({ locals, cookies });

	redirectNonParticipantsFromPaths(url, meeting.data?.me);

	return {
		meeting,
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
