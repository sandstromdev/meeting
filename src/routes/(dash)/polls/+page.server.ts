import type { PageServerLoad } from './$types';

export const load = (async () => {
	return {
		// polls: await convexLoad(api.userPoll.public.getMyOwnedPolls, {}),
	};
}) satisfies PageServerLoad;
