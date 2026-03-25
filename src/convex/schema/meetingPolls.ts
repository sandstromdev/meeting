import { defineTable } from 'convex/server';
import { v } from 'convex/values';

import {
	majorityRule,
	pollResultOptionVotesRowV,
	pollRowSharedFields,
	pollTypeConfigFields,
} from '../helpers/schema';

const meetingPollBaseFields = {
	meetingId: v.id('meetings'),
	agendaItemId: v.nullable(v.string()),
	...pollRowSharedFields,
};

export const MeetingPoll = v.object({
	...meetingPollBaseFields,
	...pollTypeConfigFields,
});
export type MeetingPoll = typeof MeetingPoll.type;

export const MeetingPollVote = v.object({
	meetingId: v.id('meetings'),
	pollId: v.id('meetingPolls'),
	userId: v.id('meetingParticipants'),
	optionIndex: v.number(),
});

export const MeetingPollResultOptionTotal = pollResultOptionVotesRowV;

export const MeetingPollResult = {
	meetingId: v.id('meetings'),
	pollId: v.id('meetingPolls'),
	closedAt: v.number(),
	poll: MeetingPoll,
	complete: v.boolean(),
	results: v.object({
		optionTotals: v.array(pollResultOptionVotesRowV),
		winners: v.array(pollResultOptionVotesRowV),
		isTie: v.boolean(),
		majorityRule: v.nullable(majorityRule),
		counts: v.object({
			totalVotes: v.number(),
			eligibleVoters: v.number(),
			usableVotes: v.number(),
			abstain: v.number(),
		}),
	}),
};

export const meetingPollTables = {
	meetingPolls: defineTable(MeetingPoll)
		.index('by_meeting', ['meetingId'])
		.index('by_meeting_agendaItem', ['meetingId', 'agendaItemId']),

	meetingPollVotes: defineTable(MeetingPollVote)
		.index('by_poll', ['pollId'])
		.index('by_poll_user', ['pollId', 'userId']),

	meetingPollResults: defineTable(MeetingPollResult)
		.index('by_poll_and_closedAt', ['pollId', 'closedAt'])
		.index('by_meeting_and_poll_and_closedAt', ['meetingId', 'pollId', 'closedAt']),
};
