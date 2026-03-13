import { getCurrentUser } from '$lib/server/auth';
import { redirectIfInMeeting, redirectIfNotAuthed } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfInMeeting('/');
	redirectIfNotAuthed('/sign-in');

	return {
		error: url.searchParams.get('error'),
		meetingCode: url.searchParams.get('m'),
		currentUser: await getCurrentUser(),
	};
}) satisfies PageServerLoad;
