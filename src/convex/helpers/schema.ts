import { v } from 'convex/values';

export const pollType = v.union(v.literal('multi_winner'), v.literal('single_winner'));
export const majorityRule = v.union(
	v.literal('simple'),
	v.literal('two_thirds'),
	v.literal('three_quarters'),
	v.literal('unanimous'),
);
export const userPollVisibilityMode = v.union(v.literal('public'), v.literal('account_required'));

/** @deprecated Use `userPollVisibilityMode` */
export const standaloneVisibilityMode = userPollVisibilityMode;

export type PollType = typeof pollType.type;
export type MajorityRule = typeof majorityRule.type;
export type UserPollVisibilityMode = typeof userPollVisibilityMode.type;
/** @deprecated Use `UserPollVisibilityMode` */
export type StandaloneVisibilityMode = UserPollVisibilityMode;

/** `type` is source of truth; branch-specific fields are optional at rest (Zod enforces on write). */
export const pollTypeConfigFields = {
	type: pollType,
	winningCount: v.optional(v.number()),
	majorityRule: v.optional(majorityRule),
};

/** Shared columns for `userPolls` and `meetingPolls` (excluding table-specific id/context fields). */
export const pollRowSharedFields = {
	title: v.string(),
	options: v.array(v.string()),
	allowsAbstain: v.boolean(),
	isOpen: v.boolean(),
	maxVotesPerVoter: v.number(),
	/** If true, everyone can see results when poll is closed; if false, only admins can. */
	isResultPublic: v.boolean(),
	openedAt: v.nullable(v.number()),
	closedAt: v.nullable(v.number()),
	updatedAt: v.number(),
};

/** One row in `results.optionTotals` or `results.winners` (same shape in stored snapshots). */
export const pollResultOptionVotesRowV = v.object({
	optionIndex: v.number(),
	option: v.string(),
	votes: v.number(),
});
