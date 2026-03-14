import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { env } from '$env/dynamic/public';
import { dashClient, sentinelClient } from '@better-auth/infra/client';

export const authClient = (customFetchImpl: typeof fetch = fetch) =>
	createAuthClient({
		plugins: [convexClient(), dashClient(), sentinelClient({ autoSolveChallenge: true })],
		fetchOptions: { customFetchImpl },
		baseURL: env.PUBLIC_SITE_URL,
	});
