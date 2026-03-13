import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import { ConvexHttpClient } from 'convex/browser';

export function getConvexClient(token?: string) {
	const { locals, fetch } = getRequestEvent();

	const auth = token ?? locals.token;

	const client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL, {
		auth,
		logger: true,
		fetch: fetch,
	});

	if (token) {
		client.setAuth(token);
	}

	return client;
}
