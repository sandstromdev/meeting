import { getCurrentUser } from '$lib/server/auth';
import { redirectIfNotAuthed } from '$lib/server/guards';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async () => {
	redirectIfNotAuthed('/sign-in');

	const currentUser = await getCurrentUser();

	if (!currentUser || currentUser?.role !== 'admin') {
		error(403, 'Forbidden');
	}

	return { currentUser };
}) satisfies LayoutServerLoad;
