import { v } from 'convex/values';
import { mutation } from '../_generated/server';
import { getMeetingByCode } from '../meetings';

export const createUser = mutation({
	args: {
		meetingCode: v.string(),
		name: v.string()
	},
	async handler(ctx, args) {
		const meeting = await getMeetingByCode(ctx, args.meetingCode);

		const user = await ctx.db.insert('users', {
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

		return user;
	}
});
