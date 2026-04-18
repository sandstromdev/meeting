import { internal } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { c } from '$convex/helpers';
import { getAbsentCounter, getParticipantCounter } from '$convex/helpers/counters';
import {
	buildMeetingPollResultSnapshot,
	getLatestMeetingPollResultSnapshot,
	getMeetingPollOrThrow,
} from '$convex/helpers/meetingPoll';
import {
	buildOptionTotalsFromVotes,
	computePollOutcome,
	rankOptionsForScoring,
	shouldSkipPollSnapshotAction,
	usableVotesFromRanked,
} from '$convex/helpers/poll';
import { normalizeStoredPollOptions } from '@lsnd-mt/common/pollOptions';
import {
	FullPollSchema,
	pollSnapshotCountsMeetingZod,
	pollSnapshotResultsCoreZod,
} from '@lsnd-mt/common/validation';
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

		const optionTotals = buildOptionTotalsFromVotes(
			normalizeStoredPollOptions(poll.options),
			votes,
		);

		const uniqueVoters = new Set<Id<'meetingParticipants'>>();
		for (const vote of votes) {
			uniqueVoters.add(vote.userId);
		}

		optionTotals.sort((a, b) => b.votes - a.votes);

		if (eligibleVoters !== uniqueVoters.size) {
			console.warn(
				`Eligible voter count ${eligibleVoters} does not match unique voter count ${uniqueVoters.size}`,
			);
			complete = false;
		}

		const ranked = rankOptionsForScoring(optionTotals, poll.allowsAbstain);
		const usableVotes = usableVotesFromRanked(ranked);

		const {
			winners,
			isTie,
			majorityRule: resultsMajorityRule,
		} = computePollOutcome(poll, ranked, { missingMajorityRuleLabel: 'meeting_poll_close' });

		const votesWithoutAbstain = usableVotes;

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
		results: pollSnapshotResultsCoreZod.extend({
			counts: pollSnapshotCountsMeetingZod,
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

		if (shouldSkipPollSnapshotAction(results.poll)) {
			return false;
		}

		return ctx.runMutation(
			internal.meeting.jobs.meetingPollClose.insertPollResultSnapshot,
			results,
		);
	});
