import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { env } from '$env/dynamic/public';

export const authClient = (customFetchImpl: typeof fetch = fetch) =>
	createAuthClient({
		plugins: [convexClient()],
		fetchOptions: { customFetchImpl },
		baseURL: env.PUBLIC_SITE_URL,
	});
