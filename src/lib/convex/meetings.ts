import { v } from 'convex/values';
import { query, type QueryCtx } from './_generated/server';

export const getMeeting = query({
	args: {
		code: v.string()
	},
	async handler(ctx, args) {
		return getMeetingByCode(ctx, args.code);
	}
});

export async function getMeetingByCode(ctx: QueryCtx, code: string) {
	let m;
	try {
		m = await ctx.db
			.query('meetings')
			.withIndex('by_code', (q) => q.eq('code', code))
			.unique();
	} catch {}

	if (!m) {
		throw new Error('Authentication failed');
	}

	return m;
}
