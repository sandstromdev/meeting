import { authClient } from '$lib/auth-client';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ fetch }) => {
	const { data, error: err } = await authClient(fetch).admin.listUsers({
		query: { limit: 100, offset: 0 },
	});

	if (err || !data) {
		console.error('Failed to list users:', err);
		error(500, 'Kunde inte hämta användare.');
	}

	return { users: data.users, total: data.total };
}) satisfies PageServerLoad;
