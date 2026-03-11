import { authed } from '$convex/helpers/auth';
import { c } from '$convex/helpers';
import { z } from 'zod';

/** Consider a participant inactive after this many milliseconds without a heartbeat. */
export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

/** Records the current user's heartbeat (call from client to mark participant active). */
export const recordHeartbeat = authed.mutation().public(async ({ ctx }) => {
	const now = Date.now();
	const existing = await ctx.db
		.query('heartbeats')
		.withIndex('by_token', (q) => q.eq('tokenIdentifier', ctx.user.tokenIdentifier))
		.first();

	if (existing) {
		await ctx.db.patch('heartbeats', existing._id, { lastSeenAt: now });
	} else {
		await ctx.db.insert('heartbeats', {
			tokenIdentifier: ctx.user.tokenIdentifier,
			lastSeenAt: now,
		});
	}
});

/** Returns whether the given tokenIdentifier has an active heartbeat (lastSeenAt within threshold). */
export const isActive = c
	.input({ tokenIdentifier: z.string() })
	.query()
	.public(async ({ ctx, args }) => {
		const heartbeat = await ctx.db
			.query('heartbeats')
			.withIndex('by_token', (q) => q.eq('tokenIdentifier', args.tokenIdentifier))
			.first();
		if (!heartbeat) {
			return false;
		}
		return heartbeat.lastSeenAt > Date.now() - INACTIVE_THRESHOLD_MS;
	});

/** Removes heartbeats older than the inactive threshold. Run by cron every 15 minutes. */
export const pruneStaleHeartbeats = c.mutation().internal(async ({ ctx }) => {
	const cutoff = Date.now() - INACTIVE_THRESHOLD_MS;
	const stale = await ctx.db
		.query('heartbeats')
		.withIndex('by_lastSeenAt', (q) => q.lt('lastSeenAt', cutoff))
		.collect();
	for (const doc of stale) {
		await ctx.db.delete('heartbeats', doc._id);
	}
	return { pruned: stale.length };
});
