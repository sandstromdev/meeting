import { v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import { signJWT } from '../auth.server';
import { getMeetingByCode } from '../meetings';
import { userQuery } from './helpers';

export const exists = query({
	args: {
		meetingCode: v.string(),
		email: v.string()
	},
	async handler(ctx, args) {
		const meeting = await getMeetingByCode(ctx, args.meetingCode);

		const user = await ctx.db
			.query('users')
			.withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase()))
			.first();

		if (!user) {
			return false;
		}

		if (user.meetingId !== meeting._id) {
			return false;
		}

		return true;
	}
});

export const login = mutation({
	args: {
		meetingCode: v.string(),
		email: v.string(),
		password: v.string()
	},
	async handler(ctx, args) {
		const meeting = await getMeetingByCode(ctx, args.meetingCode);

		const userId = await ctx.db.insert('users', {
			anonID: meeting.anonIdCounter,
			meetingId: meeting._id,
			name: args.name,
			admin: false,
			isInSpeakerQueue: false,
			isAbsent: false,
			votes: []
		});

		await ctx.db.patch('meetings', meeting._id, {
			anonIdCounter: meeting.anonIdCounter + 1
		});

		const token = await signJWT(userId, meeting._id);

		return { token };
	}
});

export const getUserData = userQuery({
	args: {},
	async handler(ctx) {
		const { admin, anonID, isAbsent, isInSpeakerQueue, name, votes } = ctx.user;

		return {
			admin,
			anonID,
			isAbsent,
			isInSpeakerQueue,
			name,
			votes
		};
	}
});
