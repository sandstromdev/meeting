import { api } from '@lsnd/convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getVoterSessionToken } from './token';
import { getConvexClient } from '$lib/server/convex';
import { getAppError } from '@lsnd/convex/helpers/error';

export const load = (async ({ params, cookies }) => {
	const currentUser = await getCurrentUser();

	const voterSessionToken = getVoterSessionToken(cookies);

	const convex = getConvexClient();

	let poll;

	try {
		poll = await convex.query(api.userPoll.public.getByCode, {
			code: params.code,
			voterSessionToken,
		});
	} catch (e) {
		const err = getAppError(e);

		if (err?.is('user_poll_code_not_found')) {
			return {
				poll: null,
				currentUser,
				voterSessionToken,
			};
		}

		console.error(e);
		throw error(500, 'Ett fel har inträffat');
	}

	if (poll?.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${params.code}`)}`);
	}

	return {
		poll,
		currentUser,
		voterSessionToken,
	};
}) satisfies PageServerLoad;
