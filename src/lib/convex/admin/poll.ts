import { v } from 'convex/values';
import { PollOption } from '../schema';
import { adminMutation } from './helpers';

export const createPoll = adminMutation({
	args: {
		title: v.string(),
		options: v.array(PollOption.omit('votes')),
		isOpen: v.boolean()
	},
	async handler(ctx, args) {
		return await ctx.db.insert('polls', {
			...args,
			options: args.options.map((o) => Object.assign(o, { votes: 0 })),
			meetingId: ctx.meeting._id
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
