import { customCtxAndArgs, customMutation } from 'convex-helpers/server/customFunctions';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, type QueryCtx } from './_generated/server';
import { authUser } from './users';
import { PollOption } from './schema';

async function authAdmin(ctx: QueryCtx, args: { meetingCode: string; userId: Id<'users'> }) {
	const data = await authUser(ctx, args);

	if (!data.user.admin) {
		throw new Error('Unauthorized');
	}

	return data;
}

/* const adminQuery = customQuery(
	query,
	customCtxAndArgs({
		args: {
			userId: v.id('users')
		},
		async input(ctx, { userId }) {
			const data = await authAdmin(ctx, userId);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
); */

const adminMutation = customMutation(
	mutation,
	customCtxAndArgs({
		args: {
			userId: v.id('users'),
			meetingCode: v.string()
		},
		async input(ctx, args) {
			const data = await authAdmin(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

export const nextSpeaker = adminMutation({
	args: {},
	async handler({ db, meeting }) {
		const { speakerQueue } = meeting;

		const queued = speakerQueue.shift();
		const previous = meeting.currentSpeaker;

		let speaker = null;

		if (queued) {
			speaker = {
				...queued,
				startTime: Date.now()
			};
		}

		if (previous) {
			await db.patch('users', previous.userId, {
				isInSpeakerQueue: false
			});
		}

		await db.patch('meetings', meeting._id, {
			currentSpeaker: speaker,
			speakerQueue
		});
	}
});

export const clearPointOfOrder = adminMutation({
	args: {},
	async handler({ db, meeting }) {
		if (!meeting.pointOfOrder) {
			return false;
		}

		await db.patch('meetings', meeting._id, {
			pointOfOrder: null
		});

		return true;
	}
});

export const createPoll = adminMutation({
	args: {
		title: v.string(),
		options: v.array(PollOption.omit('votes')),
		isOpen: v.boolean()
	},
	async handler(ctx, args) {
		return await ctx.db.insert('polls', {
			...args,
			options: args.options.map((o) => Object.assign(o, { votes: 0 }))
		});
	}
});

export const setPollOpenState = adminMutation({
	args: {
		pollId: v.id('polls'),
		isOpen: v.boolean()
	},
	async handler(ctx, { pollId, isOpen }) {
		try {
			await ctx.db.patch('polls', pollId, {
				isOpen
			});
			return true;
		} catch {
			return false;
		}
	}
});

export const addPollOption = adminMutation({
	args: {
		pollId: v.id('polls'),
		option: PollOption.omit('votes')
	},
	async handler(ctx, { pollId, option }) {
		const poll = await ctx.db.get('polls', pollId);

		if (!poll) {
			throw new Error('Poll not found');
		}

		if (poll.isOpen) {
			throw new Error('Cannot change poll while open');
		}

		await ctx.db.patch('polls', pollId, {
			options: [...poll.options, { ...option, votes: 0 }]
		});
	}
});

export const editPollOption = adminMutation({
	args: {
		pollId: v.id('polls'),
		optionIdx: v.number(),
		option: PollOption.omit('votes').partial()
	},
	async handler(ctx, { pollId, option, optionIdx }) {
		const poll = await ctx.db.get('polls', pollId);

		if (!poll) {
			throw new Error('Poll not found');
		}

		if (poll.isOpen) {
			throw new Error('Cannot change poll while open');
		}

		const options = poll.options;

		if (optionIdx < 0 || optionIdx >= options.length) {
			throw new Error('Index out of bounds');
		}

		options[optionIdx] = {
			...options[optionIdx],
			...option
		};

		await ctx.db.patch('polls', pollId, {
			options
		});
	}
});

export const removePollOption = adminMutation({
	args: {
		pollId: v.id('polls'),
		optionIdx: v.number()
	},
	async handler(ctx, { pollId, optionIdx }) {
		const poll = await ctx.db.get('polls', pollId);

		if (!poll) {
			throw new Error('Poll not found');
		}

		if (poll.isOpen) {
			throw new Error('Cannot change poll while open');
		}

		if (optionIdx < 0 || optionIdx >= poll.options.length) {
			throw new Error('Index out of bounds');
		}

		await ctx.db.patch('polls', pollId, {
			options: [...poll.options.slice(0, optionIdx), ...poll.options.slice(optionIdx + 1)]
		});
	}
});
