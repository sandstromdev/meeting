import { authClient } from '$lib/auth-client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, fetch }) => {
	const { data: user, error: err } = await authClient.admin.getUser({
		query: { id: params.id },
		fetchOptions: {
			customFetchImpl: fetch,
		},
	});

	if (err) {
		console.error('Failed to fetch user:', err);
		error(500, 'Kunde inte hämta användare.');
	}

	if (!user) {
		error(404, 'Användaren hittades inte.');
	}

	return { user };
}) satisfies PageServerLoad;
