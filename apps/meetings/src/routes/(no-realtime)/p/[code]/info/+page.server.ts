import { api } from '@lsnd-mt/convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getConvexClient } from '$lib/server/convex';
import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';
import { UserPollCodeSchema } from '$lib/validation';

export const load = (async ({ params }) => {
	const currentUser = await getCurrentUser();
	const convex = getConvexClient();

	const trimmed = params.code.trim();
	const parsedCode = UserPollCodeSchema.safeParse(trimmed);
	if (!parsedCode.success) {
		throw error(404, 'Omröstningen hittades inte');
	}

	if (trimmed !== params.code) {
		throw redirect(302, `/p/${parsedCode.data}/info`);
	}

	let info;
	try {
		info = await convex.query(api.userPoll.public.getInfoPageByCode, {
			code: parsedCode.data,
		});
	} catch (e) {
		const err = (() => {
			const convexErr = getAppError(e);
			return convexErr ? AppError.fromJSON(convexErr.toJSON()) : null;
		})();

		if (err?.is('user_poll_code_not_found')) {
			throw error(404, 'Omröstningen hittades inte');
		}

		console.error(e);
		throw error(500, 'Ett fel har inträffat');
	}

	if (info.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${parsedCode.data}/info`)}`);
	}

	if (info.code !== parsedCode.data) {
		throw redirect(302, `/p/${info.code}/info`);
	}

	return {
		info,
		currentUser,
	};
}) satisfies PageServerLoad;
