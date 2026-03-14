import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';
import { createAuth } from '$convex/auth';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const authState = await getAuthState(createAuth, cookies);

	return {
		authState,
		meetingId: locals.meetingId,
	};
};
