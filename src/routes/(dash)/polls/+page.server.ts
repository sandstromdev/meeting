import type { PageServerLoad } from './$types';

export const load = (async () => {
	return {
		// polls: await convexLoad(api.polls.public.standalone_poll.getMyOwnedPolls, {}),
	};
}) satisfies PageServerLoad;
