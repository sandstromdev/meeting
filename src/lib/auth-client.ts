import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { PUBLIC_SITE_URL } from '$env/static/public';

export const authClient = (customFetchImpl: typeof fetch) =>
	createAuthClient({
		plugins: [convexClient()],
		fetchOptions: { customFetchImpl },
		baseURL: PUBLIC_SITE_URL,
	});
