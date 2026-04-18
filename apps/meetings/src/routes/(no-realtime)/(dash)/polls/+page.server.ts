import { api } from '@lsnd-mt/convex/_generated/api';
import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';
import { redirectIfNotAuthed } from '$lib/server/guards';
import { getConvexClient } from '$lib/server/convex';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ url }) => {
	redirectIfNotAuthed(`/sign-in?redirect=${encodeURIComponent(url.pathname)}`);

	const convex = getConvexClient();

	try {
		const [currentUser, ownedPolls] = await Promise.all([
			convex.query(api.app.me.getCurrentUser, {}),
			convex.query(api.userPoll.public.getMyOwnedPolls, {}),
		]);

		const ownedPollsSorted = [...ownedPolls].toSorted(
			(a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
		);

		return { currentUser, ownedPolls: ownedPollsSorted };
	} catch (e) {
		const err = (() => {
			const convexErr = getAppError(e);
			return convexErr ? AppError.fromJSON(convexErr.toJSON()) : null;
		})();
		if (err) {
			console.error('[polls load]', e);
		} else {
			console.error('[polls load] unexpected', e);
		}
		throw error(500, 'Ett fel har inträffat');
	}
}) satisfies PageServerLoad;
