import { defineTable } from 'convex/server';
import { v } from 'convex/values';

import {
	majorityRule,
	pollResultOptionVotesRowV,
	pollRowSharedFields,
	pollTypeConfigFields,
	userPollVisibilityMode,
} from '../helpers/schema';

const userPollBaseFields = {
	code: v.string(),
	ownerUserId: v.string(),
	visibilityMode: userPollVisibilityMode,
	...pollRowSharedFields,
};

export const UserPoll = v.object({
	...userPollBaseFields,
	...pollTypeConfigFields,
});

export const UserPollVote = v.object({
	pollId: v.id('userPolls'),
	voterKey: v.string(),
	optionIndex: v.number(),
});

export const UserPollResultOptionTotal = pollResultOptionVotesRowV;

export const UserPollResult = {
	pollId: v.id('userPolls'),
	closedAt: v.number(),
	poll: UserPoll,
	complete: v.boolean(),
	results: v.object({
		optionTotals: v.array(pollResultOptionVotesRowV),
		winners: v.array(pollResultOptionVotesRowV),
		isTie: v.boolean(),
		majorityRule: v.nullable(majorityRule),
		counts: v.object({
			totalVotes: v.number(),
			usableVotes: v.number(),
			abstain: v.number(),
		}),
	}),
};

export const userPollTables = {
	userPolls: defineTable(UserPoll)
		.index('by_code', ['code'])
		.index('by_ownerUserId_and_updatedAt', ['ownerUserId', 'updatedAt']),

	userPollVotes: defineTable(UserPollVote)
		.index('by_poll', ['pollId'])
		.index('by_poll_and_voterKey', ['pollId', 'voterKey']),

	userPollResults: defineTable(UserPollResult).index('by_poll_and_closedAt', [
		'pollId',
		'closedAt',
	]),
};
