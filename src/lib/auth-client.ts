import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { resolve } from '$app/paths';

export const authClient = createAuthClient({
	plugins: [convexClient(), adminClient()],
});

export async function leaveMeeting() {
	await fetch(resolve('/api/leave-meeting'), { method: 'POST' });
}

export async function signOut() {
	await fetch(resolve('/api/leave-meeting'), { method: 'POST' });

	await authClient.signOut();
}
