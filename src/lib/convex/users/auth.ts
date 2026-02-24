import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getMeetingByCode } from '../meetings';
import { userQuery } from './helpers';
import { signJWT } from '../auth.server';

export const createUser = mutation({
	args: {
		meetingCode: v.string(),
		name: v.string()
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
