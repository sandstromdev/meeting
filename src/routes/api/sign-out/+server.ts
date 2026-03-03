import { authClient } from '$lib/auth-client';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';

export const GET = (async ({ fetch }) => {
	await authClient.signOut({ fetchOptions: { customFetchImpl: fetch } });
	deleteMeetingCookie();

	redirect(307, '/sign-in');
}) satisfies RequestHandler;
