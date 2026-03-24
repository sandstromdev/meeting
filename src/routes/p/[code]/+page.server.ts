import { api } from '$convex/_generated/api';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ params }) => {
	const poll = await convexLoad(api.public.standalone_poll.get_by_code, {
		code: params.code,
	});

	if (!poll) {
		throw error(404, 'Omröstningen hittades inte');
	}

	const currentUser = await convexLoad(api.me.getCurrentUser, {});

	if (poll.data?.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${params.code}`)}`);
	}

	return {
		poll,
		currentUser,
	};
}) satisfies PageServerLoad;
