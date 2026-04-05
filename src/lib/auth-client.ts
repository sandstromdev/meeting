import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { resolve } from '$app/paths';
import { env } from '$env/dynamic/public';

export const authClient = createAuthClient({
	baseURL: env.PUBLIC_BETTER_AUTH_URL || env.PUBLIC_SITE_URL,
	plugins: [convexClient(), adminClient()],
});

export async function leaveMeeting() {
	await fetch(resolve('/api/leave-meeting'), { method: 'POST' });
}

export async function signOut() {
	await fetch(resolve('/api/leave-meeting'), { method: 'POST' });

	await authClient.signOut();
}
