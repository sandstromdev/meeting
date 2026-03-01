import { withMe } from '$convex/helpers/auth';
import { getPoll } from '$convex/helpers/poll';
import { requireNotAbsent } from '$convex/helpers/users';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const vote = withMe
	.mutation()
	.input({ pollId: zid('polls'), option: z.number() })
	.public(async ({ ctx, args }) => {
		const { db, me } = ctx;
		const { pollId, option } = args;

		requireNotAbsent(me, 'Cannot vote while absent');

		if (me.votes.find((v) => v.pollId === pollId) != null) {
			return false;
		}

		await db.patch('meetingParticipants', me._id, {
			votes: [
				...me.votes,
				{
					pollId,
					option,
				},
			],
		});

		const poll = await getPoll(ctx, pollId, option);

		poll.options[option].votes += 1;

		await db.patch('polls', pollId, {
			options: poll.options,
		});

		return true;
	});

export const removeVote = withMe
	.mutation()
	.input({ pollId: zid('polls') })
	.public(async ({ ctx, args }) => {
		const { db, me } = ctx;
		const { pollId } = args;

		const voteIdx = me.votes.findIndex((v) => v.pollId === pollId);
		const vote = me.votes[voteIdx];

		if (!vote) {
			return false;
		}

		const poll = await getPoll(ctx, vote.pollId, vote.option);

		poll.options[vote.option].votes -= 1;

		await db.patch('polls', vote.pollId, {
			options: poll.options,
		});

		await db.patch('meetingParticipants', me._id, {
			votes: [...me.votes.slice(0, voteIdx), ...me.votes.slice(voteIdx + 1)],
		});

		return true;
	});

export const hasVoted = withMe
	.query()
	.input({ pollId: zid('polls') })
	.public(async ({ ctx, args }) => {
		const { me } = ctx;
		const { pollId } = args;

		return me.votes.find((v) => v.pollId === pollId) != null;
	});
