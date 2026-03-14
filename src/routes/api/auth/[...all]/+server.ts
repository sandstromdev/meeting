import { env } from '$env/dynamic/public';
import type { RequestHandler } from '@sveltejs/kit';

const handler = (async ({ request, fetch }) => {
	const requestUrl = new URL(request.url);
	const convexSiteUrl = env.PUBLIC_CONVEX_SITE_URL;

	if (!convexSiteUrl) {
		throw new Error('PUBLIC_CONVEX_SITE_URL environment variable is not set');
	}

	const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;

	const newRequest = new Request(nextUrl, request);

	newRequest.headers.set('host', new URL(nextUrl).host);
	newRequest.headers.set('accept-encoding', 'application/json');

	console.log({
		originalUrl: request.url,
		nextUrl,
		newRequest: {
			headers: newRequest.headers,
			method: newRequest.method,
		},
	});

	return await fetch(newRequest, { method: request.method, redirect: 'manual' });
}) satisfies RequestHandler;

export const GET = handler;
export const POST = handler;
