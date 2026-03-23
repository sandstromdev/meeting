import { redirectIfNotAuthed } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfNotAuthed(`/sign-in?redirect=${encodeURIComponent(url.pathname)}`);
}) satisfies PageServerLoad;
