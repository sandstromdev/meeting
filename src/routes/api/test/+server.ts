import { api } from '$convex/_generated/api';
import { PUBLIC_CONVEX_SITE_URL, PUBLIC_CONVEX_URL } from '$env/static/public';
import { getConvexClient } from '$lib/server/convex';
import { ConvexHttpClient } from 'convex/browser';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch, locals }) => {
	const convex = getConvexClient({ fetch, locals });
	const c2 = new ConvexHttpClient(PUBLIC_CONVEX_URL, { fetch, logger: true });

	const response1 = await convex
		.query(api.meetings.ping, {})
		.then((response) => ({ response }))
		.catch((error) => ({ error }));

	const response2 = await fetch(`${PUBLIC_CONVEX_SITE_URL}/api/test`)
		.then(async (response) => ({
			response: await response.text(),
			status: response.status,
			headers: Object.fromEntries(response.headers.entries()),
		}))
		.catch((error) => ({ error }));

	const response3 = await c2
		.query(api.meetings.ping, {})
		.then((response) => ({ response }))
		.catch((error) => ({ error }));

	console.log({ response1, response2, response3 });

	return Response.json({
		response1,
		response2,
		response3,
	});
};
