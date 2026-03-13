import { api } from '$convex/_generated/api';
import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';
import { getConvexClient } from '$lib/server/convex';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
	const convex = getConvexClient();

	const response1 = await convex.query(api.meetings.ping, {}).catch((e) => e);
	const response2 = await fetch(`${PUBLIC_CONVEX_SITE_URL}/api/test`).catch((e) => e);

	return Response.json({
		response1,
		response2,
	});
};
