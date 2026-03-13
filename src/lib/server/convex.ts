import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';

export function getConvexClient(event?: Pick<RequestEvent, 'locals' | 'fetch'>, token?: string) {
	const { locals, fetch } = event ?? getRequestEvent();

	const auth = token ?? locals.token;

	const client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL, {
		fetch,
		logger: true,
	});

	if (auth) {
		client.setAuth(auth);
	}

	return client;
}
