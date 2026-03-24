import type { PageServerLoad } from './$types';

export const load = (async () => {
	return {
		// polls: await convexLoad(api.public.standalone_poll.get_my_owned_polls, {}),
	};
}) satisfies PageServerLoad;
