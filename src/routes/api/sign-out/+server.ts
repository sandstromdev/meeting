import { authClient } from '$lib/auth-client';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';

export const GET = (async ({ cookies, url, fetch }) => {
	await authClient.signOut({
		fetchOptions: {
			customFetchImpl: fetch,
		},
	});

	deleteMeetingCookie(cookies);

	const redirectUrl = url.searchParams.get('redirect');

	if (redirectUrl) {
		redirect(307, redirectUrl);
	}

	return new Response(null, { status: 204 });
}) satisfies RequestHandler;
