import { redirectIfAuthed } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfAuthed('/m');

	return {
		redirect: url.searchParams.get('redirect'),
		email: url.searchParams.get('email'),
	};
}) satisfies PageServerLoad;
