import {
	loadMeetingWithHttpClient,
	redirectNonParticipantsFromPaths,
} from '$lib/server/meeting-route-guards';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, cookies, url }) => {
	const meetingPayload = await loadMeetingWithHttpClient({ locals, cookies });

	redirectNonParticipantsFromPaths(url, meetingPayload.me);

	return {
		meetingId: locals.meetingId,
	};
}) satisfies LayoutServerLoad;
