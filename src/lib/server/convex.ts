import { getRequestEvent } from '$app/server';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';

export function getConvexClient(event?: Pick<RequestEvent, 'locals' | 'fetch'>) {
	const { locals, fetch } = event ?? getRequestEvent();

	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL, {
		fetch,
		// logger: true,
	});

	if (locals.token) {
		client.setAuth(locals.token);
	}

	return client;
}
