import { redirectIfAuthed } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfAuthed('/');

	return {
		redirect: url.searchParams.get('redirect'),
	};
}) satisfies PageServerLoad;
