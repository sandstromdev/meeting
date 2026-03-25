import { api } from '$convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getVoterSessionToken } from './token';

export const load = (async ({ params, cookies }) => {
	const currentUser = await getCurrentUser();

	const voterSessionToken = getVoterSessionToken(cookies);

	const poll = await convexLoad(api.userPoll.public.getByCode, {
		code: params.code,
		voterSessionToken,
	});

	if (!poll.data) {
		throw error(404, 'Omröstningen hittades inte');
	}

	if (poll.data?.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${params.code}`)}`);
	}

	const voteCounts = await convexLoad(api.userPoll.public.getVoteCounts, {
		pollId: poll.data.id,
	});

	return {
		poll,
		voteCounts,
		currentUser,
		voterSessionToken,
	};
}) satisfies PageServerLoad;
