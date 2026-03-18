import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		authState: getAuthState(),
		meetingId: locals.meetingId,
	};
};
