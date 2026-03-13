import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async () => {
	deleteMeetingCookie();
	redirect(307, '/anslut');
}) satisfies RequestHandler;
