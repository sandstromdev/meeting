import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { getEditablePoll } from '$convex/helpers/poll';
import { admin } from '$convex/helpers/auth';

const pollOption = z.object({
	description: z.string().nullable(),
	title: z.string(),
	votes: z.number(),
});

export const createPoll = admin
	.mutation()
	.input({
		title: z.string(),
		options: z.array(pollOption),
		isOpen: z.boolean(),
	})
	.public(async ({ ctx, args }) => {
		return await ctx.db.insert('polls', {
			...args,
			options: args.options.map((o) => Object.assign(o, { votes: 0 })),
			meetingId: ctx.meeting._id,
		});
	});

export const setPollOpenState = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		isOpen: z.boolean(),
	})
	.public(async ({ ctx, args: { pollId, isOpen } }) => {
		try {
			await ctx.db.patch('polls', pollId, {
				isOpen,
			});
			return true;
		} catch {
			return false;
		}
	});

export const addPollOption = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		option: pollOption,
	})
	.public(async ({ ctx, args: { pollId, option } }) => {
		const poll = await getEditablePoll(ctx, pollId);

		await ctx.db.patch('polls', pollId, {
			options: [...poll.options, { ...option, votes: 0 }],
		});
	});

export const editPollOption = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		optionIdx: z.number(),
		option: pollOption.partial(),
	})
	.public(async ({ ctx, args: { pollId, option, optionIdx } }) => {
		const poll = await getEditablePoll(ctx, pollId, optionIdx);

		const { options } = poll;

		options[optionIdx] = {
			...options[optionIdx],
			...option,
		};

		await ctx.db.patch('polls', pollId, {
			options,
		});
	});

export const removePollOption = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		optionIdx: z.number(),
	})
	.public(async ({ ctx, args: { pollId, optionIdx } }) => {
		const poll = await getEditablePoll(ctx, pollId, optionIdx);

		await ctx.db.patch('polls', pollId, {
			options: [...poll.options.slice(0, optionIdx), ...poll.options.slice(optionIdx + 1)],
		});
	});
