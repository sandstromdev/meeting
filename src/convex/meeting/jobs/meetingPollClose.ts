import { internal } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { c } from '$convex/helpers';
import { getAbsentCounter, getParticipantCounter } from '$convex/helpers/counters';
import {
	buildMeetingPollResultSnapshot,
	getLatestMeetingPollResultSnapshot,
	getMeetingPollOrThrow,
	stripAbstain,
	type OptionTotal,
} from '$convex/helpers/meetingPoll';
import { minimumVotesForMajority } from '$lib/polls';
import { FullPollSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const getPollResults = c
	.query()
	.input({ pollId: zid('meetingPolls') })
	.internal(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);

		const [participants, absentees, votes] = await Promise.all([
			getParticipantCounter(poll.meetingId).count(ctx),
			getAbsentCounter(poll.meetingId).count(ctx),
			ctx.db
				.query('meetingPollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
				.collect(),
		]);

		let complete = true;

		const eligibleVoters = Math.max(0, participants - absentees);

		const optionTotals = poll.options.map((option, optionIndex) => ({
			optionIndex,
			option,
			votes: 0,
		}));

		const uniqueVoters = new Set<Id<'meetingParticipants'>>();

		for (const vote of votes) {
			uniqueVoters.add(vote.userId);
			if (vote.optionIndex >= 0 && vote.optionIndex < optionTotals.length) {
				optionTotals[vote.optionIndex].votes += 1;
			}
		}

		optionTotals.sort((a, b) => b.votes - a.votes);

		if (eligibleVoters !== uniqueVoters.size) {
			console.warn(
				`Eligible voter count ${eligibleVoters} does not match unique voter count ${uniqueVoters.size}`,
			);
			complete = false;
		}

		const options = stripAbstain(optionTotals, poll.allowsAbstain).toSorted(
			(a, b) => b.votes - a.votes,
		);
		const usableVotes = options.reduce((acc, o) => acc + o.votes, 0);

		let winners: OptionTotal[];
		let isTie: boolean;
		let resultsMajorityRule: (typeof poll)['majorityRule'] | null = null;

		if (poll.type === 'multi_winner') {
			const wc = Math.max(1, Math.min(poll.winningCount ?? 1, options.length));
			const thresholdVotes = options[wc - 1]?.votes ?? 0;
			winners = options.filter((o) => o.votes >= thresholdVotes);
			const lastWinnerVotes = winners[wc - 1]?.votes;
			isTie =
				lastWinnerVotes != null && options.filter((o) => o.votes === lastWinnerVotes).length > 1;
		} else {
			const rule = poll.majorityRule;
			if (rule == null) {
				throw new Error('meeting_poll_close: single_winner poll missing majorityRule');
			}
			const minVotes = minimumVotesForMajority(rule, usableVotes);
			const topVotes = options[0]?.votes;
			winners = options.filter((o) => o.votes >= minVotes && o.votes === topVotes);
			isTie = winners.length > 1;
			resultsMajorityRule = rule;
		}

		const votesWithoutAbstain = options.reduce((acc, o) => acc + o.votes, 0);

		return {
			poll,

			complete,

			results: {
				optionTotals,
				winners,
				isTie,
				majorityRule: resultsMajorityRule,

				counts: {
					totalVotes: votes.length,
					eligibleVoters,
					usableVotes,
					abstain: votes.length - votesWithoutAbstain,
				},
			},
		};
	});

export const insertPollResultSnapshot = c
	.mutation()
	.input({
		poll: FullPollSchema,
		complete: z.boolean(),
		results: z.object({
			optionTotals: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			winners: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			isTie: z.boolean(),
			majorityRule: z.enum(['simple', 'two_thirds', 'three_quarters', 'unanimous']).nullable(),
			counts: z.object({
				totalVotes: z.number(),
				eligibleVoters: z.number(),
				usableVotes: z.number(),
				abstain: z.number(),
			}),
		}),
	})
	.internal(async ({ ctx, args }) => {
		if (args.poll.closedAt == null) {
			return false;
		}

		const latestSnapshot = await getLatestMeetingPollResultSnapshot(ctx.db, args.poll._id);

		if (latestSnapshot?.closedAt === args.poll.closedAt) {
			return false;
		}

		await ctx.db.insert('meetingPollResults', buildMeetingPollResultSnapshot(args));

		return true;
	});

export const createPollResultSnapshotAction = c
	.action()
	.input({ pollId: zid('meetingPolls') })
	.internal(async ({ ctx, args }): Promise<boolean> => {
		const results = await ctx.runQuery(internal.meeting.jobs.meetingPollClose.getPollResults, {
			pollId: args.pollId,
		});

		if (results.poll.isOpen || results.poll.closedAt == null) {
			return false;
		}

		return ctx.runMutation(
			internal.meeting.jobs.meetingPollClose.insertPollResultSnapshot,
			results,
		);
	});
