import { redirectIfNotAuthed } from '$lib/server/guards';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';
import { api } from '$convex/_generated/api';

export const load = (async ({ url }) => {
	redirectIfNotAuthed(`/sign-in?redirect=${encodeURIComponent(url.pathname)}`);

	return {
		currentUser: await convexLoad(api.app.me.getCurrentUser, {}),
	};
}) satisfies LayoutServerLoad;
