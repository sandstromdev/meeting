import { api } from '$convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getVoterSessionToken } from './token';
import { getConvexClient } from '$lib/server/convex';

export const load = (async ({ params, cookies }) => {
	const currentUser = await getCurrentUser();

	const voterSessionToken = getVoterSessionToken(cookies);

	const convex = getConvexClient();

	const poll = await convex.query(api.userPoll.public.getByCode, {
		code: params.code,
		voterSessionToken,
	});

	if (!poll) {
		throw error(404, 'Omröstningen hittades inte');
	}

	if (poll.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${params.code}`)}`);
	}

	return {
		poll,
		currentUser,
		voterSessionToken,
	};
}) satisfies PageServerLoad;
