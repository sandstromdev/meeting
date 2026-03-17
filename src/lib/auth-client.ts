import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { env } from '$env/dynamic/public';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = (customFetchImpl: typeof fetch = fetch) =>
	createAuthClient({
		plugins: [convexClient(), adminClient()],
		fetchOptions: { customFetchImpl },
		baseURL: env.PUBLIC_SITE_URL,
	});
