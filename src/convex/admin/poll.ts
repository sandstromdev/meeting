import { v } from 'convex/values';
import { getEditablePoll } from '../helpers.server';
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
		const poll = await getEditablePoll(ctx, pollId);

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
		const poll = await getEditablePoll(ctx, pollId, optionIdx);

		const { options } = poll;

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
		const poll = await getEditablePoll(ctx, pollId, optionIdx);

		await ctx.db.patch('polls', pollId, {
			options: [...poll.options.slice(0, optionIdx), ...poll.options.slice(optionIdx + 1)]
		});
	}
});
