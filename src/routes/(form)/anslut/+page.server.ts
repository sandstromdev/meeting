import { redirectIfInMeeting } from '$lib/server/meeting-cookie';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	redirectIfInMeeting('/');

	return {};
}) satisfies PageServerLoad;
