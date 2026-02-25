import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth.js';
import { getConvexClient } from '$lib/server/convex';
import { getMeeting } from '$lib/server/meeting-cookie';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const authState = await getAuthState(createAuth, cookies);

	const meeting = await getMeeting();

	const client = getConvexClient();

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		return { authState, currentUser, meeting };
	} catch {
		return { authState, currentUser: null, meeting };
	}
};
