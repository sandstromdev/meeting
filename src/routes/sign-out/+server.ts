import { authClient } from '$lib/auth-client';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async () => {
	await authClient.signOut();

	deleteMeetingCookie();

	redirect(307, '/sign-in');
}) satisfies RequestHandler;
