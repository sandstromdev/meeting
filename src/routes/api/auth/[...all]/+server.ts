import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';
import type { RequestHandler } from '@sveltejs/kit';

const handler = (async ({ request, fetch }) => {
	const requestUrl = new URL(request.url);
	const convexSiteUrl = PUBLIC_CONVEX_SITE_URL;

	if (!convexSiteUrl) {
		throw new Error('PUBLIC_CONVEX_SITE_URL environment variable is not set');
	}

	const nextUrl = `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`;

	// console.log('nextUrl', nextUrl);

	const newRequest = new Request(nextUrl, request);

	newRequest.headers.set('host', new URL(nextUrl).host);
	newRequest.headers.set('accept-encoding', 'application/json');

	const response = await fetch(newRequest, { method: request.method, redirect: 'manual' });

	/* console.log('response', {
		status: response.status,
		headers: response.headers,
	}); */

	return response;
}) satisfies RequestHandler;

export const GET = handler;
export const POST = handler;
