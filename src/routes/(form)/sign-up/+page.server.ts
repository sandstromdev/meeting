import { redirectIfAuthed } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	redirectIfAuthed('/');

	return {};
}) satisfies PageServerLoad;
