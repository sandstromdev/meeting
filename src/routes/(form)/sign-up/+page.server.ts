import { redirectIfAuthed } from '$lib/auth';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	redirectIfAuthed('/');

	return {};
}) satisfies PageServerLoad;
