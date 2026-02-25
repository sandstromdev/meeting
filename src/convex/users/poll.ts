import { v } from 'convex/values';
import { getPoll } from '../helpers.server';
import { requireNotAbsent, userMutation, userQuery } from './helpers';

export const vote = userMutation({
	args: {
		pollId: v.id('polls'),
		option: v.number()
	},
	async handler(ctx, { pollId, option }) {
		const { user } = ctx;

		requireNotAbsent(user, 'Cannot vote while absent');

		if (user.votes.find((v) => v.pollId === pollId) != null) {
			return false;
		}

		await ctx.db.patch('users', user._id, {
			votes: [
				...user.votes,
				{
					pollId,
					option
				}
			]
		});

		const poll = await getPoll(ctx, pollId, option);

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

		const poll = await getPoll(ctx, vote.pollId, vote.option);

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
