import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import { createConvexHttpClient } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export function getConvexClient(token?: string) {
	const event = getRequestEvent();

	const client = createConvexHttpClient({
		convexUrl: env.PUBLIC_CONVEX_URL,
		token: token ?? event.locals.token,
		options: {
			logger: true,
		},
	});

	return client;
}
