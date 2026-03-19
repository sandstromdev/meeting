import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import type { RequestHandler } from './$types';

export const POST = (async ({ cookies }) => {
	deleteMeetingCookie(cookies);
	return new Response(null, { status: 204 });
}) satisfies RequestHandler;
