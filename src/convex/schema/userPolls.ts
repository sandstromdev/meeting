import { defineTable } from 'convex/server';
import { v } from 'convex/values';

import { majorityRule, pollTypeConfigFields, userPollVisibilityMode } from '../helpers/schema';

const userPollBaseFields = {
	code: v.string(),
	ownerUserId: v.string(),
	visibilityMode: userPollVisibilityMode,
	title: v.string(),
	options: v.array(v.string()),
	allowsAbstain: v.boolean(),
	isOpen: v.boolean(),
	maxVotesPerVoter: v.number(),
	isResultPublic: v.boolean(),
	openedAt: v.nullable(v.number()),
	closedAt: v.nullable(v.number()),
	updatedAt: v.number(),
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

export const UserPollResultOptionTotal = v.object({
	optionIndex: v.number(),
	option: v.string(),
	votes: v.number(),
});

export const UserPollResult = {
	pollId: v.id('userPolls'),
	closedAt: v.number(),
	poll: UserPoll,
	complete: v.boolean(),
	results: v.object({
		optionTotals: v.array(UserPollResultOptionTotal),
		winners: v.array(
			v.object({
				optionIndex: v.number(),
				option: v.string(),
				votes: v.number(),
			}),
		),
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
