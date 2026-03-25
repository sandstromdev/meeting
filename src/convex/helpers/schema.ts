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
