import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';

export function getConvexClient(event?: Pick<RequestEvent, 'locals' | 'fetch'>) {
	const { locals, fetch } = event ?? getRequestEvent();

	const client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL, {
		fetch,
		// logger: true,
	});

	if (locals.token) {
		client.setAuth(locals.token);
	}

	return client;
}
