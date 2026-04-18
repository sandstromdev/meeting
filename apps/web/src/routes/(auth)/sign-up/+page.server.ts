import { PUBLIC_ENABLE_SIGNUP } from '$env/static/public';
import { redirectIfAuthed } from '$lib/server/guards';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfAuthed('/m');

	if (PUBLIC_ENABLE_SIGNUP === 'false') {
		redirect(307, '/sign-in');
	}

	return {
		redirect: url.searchParams.get('redirect'),
	};
}) satisfies PageServerLoad;
