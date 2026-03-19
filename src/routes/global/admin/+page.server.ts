import { authClient } from '$lib/auth-client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ fetch }) => {
	const { data, error: err } = await authClient.admin.listUsers({
		query: { limit: 100, offset: 0 },
		fetchOptions: {
			customFetchImpl: fetch,
		},
	});

	if (err || !data) {
		console.error('Failed to list users:', err);
		error(500, 'Kunde inte hämta användare.');
	}

	return { users: data.users, total: data.total };
}) satisfies PageServerLoad;
