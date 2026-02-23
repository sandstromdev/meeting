import { v } from 'convex/values';
import type { QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

export const authArgs = {
	userId: v.id('users'),
	meetingCode: v.string()
};

export type AuthArgs = {
	userId: Id<'users'>;
	meetingCode: string;
};

export async function auth(ctx: QueryCtx, args: AuthArgs) {
	const user = await ctx.db.get('users', args.userId);

	if (!user) {
		throw new Error('Unauthenticated');
	}

	const meeting = await ctx.db.get('meetings', user.meetingId);

	if (!meeting || meeting.code !== args.meetingCode) {
		throw new Error('Meeting not found');
	}

	return { user, meeting };
}
