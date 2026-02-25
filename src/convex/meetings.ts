import { v } from 'convex/values';
import { type QueryCtx } from './_generated/server';
import { authedQuery } from './auth.server';
import { AppError, errors } from './error';

export const getMeeting = authedQuery
	.input({
		meetingCode: v.string()
	})
	.handler(async (ctx, args) => getMeetingByCode(ctx, args.meetingCode))
	.public();

export const getMeetingById = authedQuery
	.input({
		meetingId: v.id('meetings')
	})
	.handler(async (ctx, args) => ctx.db.get('meetings', args.meetingId))
	.public();

export async function getMeetingByCode(ctx: QueryCtx, meetingCode: string) {
	let m;
	try {
		m = await ctx.db
			.query('meetings')
			.withIndex('by_code', (q) => q.eq('code', meetingCode))
			.unique();
	} catch {}

	if (!m) {
		throw new AppError(errors.meeting_not_found({ meetingCode }));
	}

	return m;
}
