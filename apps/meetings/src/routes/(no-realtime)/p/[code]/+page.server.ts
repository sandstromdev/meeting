import { api } from '@lsnd-mt/convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getVoterSessionToken } from './token';
import { getConvexClient } from '$lib/server/convex';
import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';
import { UserPollCodeSchema } from '$lib/validation';

export const load = (async ({ params, cookies }) => {
	const currentUser = await getCurrentUser();

	const voterSessionToken = getVoterSessionToken(cookies);

	const convex = getConvexClient();

	const trimmed = params.code.trim();
	const parsedCode = UserPollCodeSchema.safeParse(trimmed);
	if (!parsedCode.success) {
		return {
			poll: null,
			currentUser,
			voterSessionToken,
		};
	}

	if (trimmed !== params.code) {
		throw redirect(302, `/p/${parsedCode.data}`);
	}

	let poll;

	try {
		poll = await convex.query(api.userPoll.public.getByCode, {
			code: parsedCode.data,
			voterSessionToken,
		});
	} catch (e) {
		const err = (() => {
			const convexErr = getAppError(e);
			return convexErr ? AppError.fromJSON(convexErr.toJSON()) : null;
		})();

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
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${parsedCode.data}`)}`);
	}

	if (poll && poll.code !== parsedCode.data) {
		throw redirect(302, `/p/${poll.code}`);
	}

	return {
		poll,
		currentUser,
		voterSessionToken,
	};
}) satisfies PageServerLoad;
