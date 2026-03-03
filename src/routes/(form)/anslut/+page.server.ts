import { getCurrentUser } from '$lib/server/auth';
import { redirectIfInMeeting } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	redirectIfInMeeting('/');

	return {
		currentUser: await getCurrentUser(),
	};
}) satisfies PageServerLoad;
