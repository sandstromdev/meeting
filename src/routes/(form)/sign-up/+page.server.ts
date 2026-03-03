import { redirectIfAuthed } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	redirectIfAuthed('/');

	return {};
}) satisfies PageServerLoad;
