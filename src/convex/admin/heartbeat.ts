import { INACTIVE_THRESHOLD_MS } from '$convex/heartbeat';
import { admin } from '$convex/helpers/auth';

export const getActiveHeartbeats = admin.query().public(async ({ ctx }) => {
	const heartbeats = await ctx.db
		.query('heartbeats')
		.withIndex('by_lastSeenAt', (q) => q.gt('lastSeenAt', Date.now() - INACTIVE_THRESHOLD_MS))
		.collect();

	return heartbeats;
});
