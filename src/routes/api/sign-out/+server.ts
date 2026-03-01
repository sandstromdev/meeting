import { authClient } from '$lib/auth-client';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async ({ fetch }) => {
	await authClient.signOut({ fetchOptions: { customFetchImpl: fetch } });

	redirect(307, '/sign-in');
}) satisfies RequestHandler;
