import { v } from 'convex/values';
import { mutation, query, type QueryCtx } from './_generated/server';
import { getMeetingByCode } from './meetings';
import {
	customMutation,
	customCtxAndArgs,
	customQuery
} from 'convex-helpers/server/customFunctions';
import type { Id } from './_generated/dataModel';

export async function authUser(ctx: QueryCtx, args: { meetingCode: string; userId: Id<'users'> }) {
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
const userQuery = customQuery(
	query,
	customCtxAndArgs({
		args: {
			userId: v.id('users'),
			meetingCode: v.string()
		},
		async input(ctx, args) {
			const data = await authUser(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

const userMutation = customMutation(
	mutation,
	customCtxAndArgs({
		args: {
			userId: v.id('users'),
			meetingCode: v.string()
		},
		async input(ctx, args) {
			const data = await authUser(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

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
			votes: []
		});

		await ctx.db.patch('meetings', meeting._id, {
			anonIdCounter: meeting.anonIdCounter + 1
		});

		return user;
	}
});

export const placeInSpeakerQueue = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (user.isInSpeakerQueue || meeting.break?.type === 'accepted') {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			speakerQueue: [
				...meeting.speakerQueue,
				{
					name: user.name,
					userId: user._id
				}
			]
		});

		await db.patch('users', user._id, {
			isInSpeakerQueue: true
		});

		return true;
	}
});

export const recallSpeakerQueueRequest = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		const filtered = meeting.speakerQueue.filter((p) => p.userId !== user._id);

		if (filtered.length !== meeting.speakerQueue.length) {
			await db.patch('meetings', meeting._id, {
				speakerQueue: filtered
			});
		}

		if (user.isInSpeakerQueue) {
			await db.patch('users', user._id, {
				isInSpeakerQueue: false
			});
		}
	}
});

export const requestPointOfOrder = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (meeting.pointOfOrder) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: {
				name: user.name,
				userId: user._id,
				startTime: Date.now()
			}
		});

		return true;
	}
});

export const recallPointOfOrderRequest = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (meeting.pointOfOrder?.userId !== user._id) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: null
		});

		return true;
	}
});

export const requestBreak = userMutation({
	args: {},
	async handler({ db, meeting, user }) {
		if (!meeting.break) {
			return;
		}

		await db.patch('meetings', meeting._id, {
			break: {
				type: 'requested',
				by: {
					userId: user._id,
					name: user.name
				}
			}
		});
	}
});

export const vote = userMutation({
	args: {
		pollId: v.id('polls'),
		option: v.number()
	},
	async handler(ctx, { pollId, option }) {
		if (ctx.user.votes.find((v) => v.pollId === pollId) != null) {
			return false;
		}

		const poll = await ctx.db.get('polls', pollId);

		if (!poll) {
			throw new Error('Poll not found');
		}

		/* const voteId = await ctx.db.insert('votes', {
			pollId,
			option,
			userId: ctx.user._id
		}); */

		await ctx.db.patch('users', ctx.user._id, {
			votes: [
				...ctx.user.votes,
				{
					pollId,
					option
				}
			]
		});

		if (option < 0 || option >= poll.options.length) {
			throw new Error('Index out of bounds');
		}

		poll.options[option].votes += 1;

		await ctx.db.patch('polls', pollId, {
			options: poll.options
		});

		return true;
	}
});

export const removeVote = userMutation({
	args: {
		pollId: v.id('polls')
	},
	async handler(ctx, { pollId }) {
		const voteIdx = ctx.user.votes.findIndex((v) => v.pollId === pollId);

		const vote = ctx.user.votes[voteIdx];

		if (!vote) {
			return false;
		}

		const poll = await ctx.db.get('polls', vote.pollId);

		if (!poll) {
			throw new Error('Poll not found');
		}

		poll.options[vote.option].votes -= 1;

		await ctx.db.patch('polls', vote.pollId, {
			options: poll.options
		});

		await ctx.db.patch('users', ctx.user._id, {
			votes: [...ctx.user.votes.slice(0, voteIdx), ...ctx.user.votes.slice(voteIdx + 1)]
		});

		return true;
	}
});

export const hasVoted = userQuery({
	args: {
		pollId: v.id('polls')
	},
	async handler(ctx, { pollId }) {
		return ctx.user.votes.find((v) => v.pollId === pollId) != null;
	}
});
