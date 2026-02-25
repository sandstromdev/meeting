import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/public';
import { ConvexHttpClient } from 'convex/browser';

export function getConvexClient() {
	const event = getRequestEvent();

	const client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL, { auth: event.locals.token });

	return client;
}
