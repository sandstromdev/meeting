import { v } from 'convex/values';

export const pollType = v.union(v.literal('multi_winner'), v.literal('single_winner'));
export const majorityRule = v.union(
	v.literal('simple'),
	v.literal('relative'),
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

export const pollResultVisibility = v.union(
	v.literal('none'),
	v.literal('winner'),
	v.literal('full'),
);
export type PollResultVisibility = typeof pollResultVisibility.type;

/** `type` is source of truth; branch-specific fields are optional at rest (Zod enforces on write). */
export const pollTypeConfigFields = {
	type: pollType,
	winningCount: v.optional(v.number()),
	majorityRule: v.optional(majorityRule),
};

/** One poll option as stored on `meetingPolls` / `userPolls`. */
export const pollOptionRowV = v.object({
	title: v.string(),
	description: v.nullable(v.string()),
});

export const pollOptionsStoredV = v.array(pollOptionRowV);

/** Shared columns for `userPolls` and `meetingPolls` (excluding table-specific id/context fields). */
export const pollRowSharedFields = {
	title: v.string(),
	options: pollOptionsStoredV,
	allowsAbstain: v.boolean(),
	isOpen: v.boolean(),
	maxVotesPerVoter: v.number(),
	/**
	 * @deprecated Prefer `resultVisibility`. Legacy mirror of full public totals (`full` vs not). Omit on new writes when
	 * `resultVisibility` is set; readers should use `effectiveResultVisibility` (treat omitted as false when `resultVisibility` absent).
	 */
	isResultPublic: v.optional(v.boolean()),
	/** Preferred: how much non-privileged viewers see. Omit on older docs (derive from `isResultPublic`). */
	resultVisibility: v.optional(pollResultVisibility),
	openedAt: v.nullable(v.number()),
	closedAt: v.nullable(v.number()),
	updatedAt: v.number(),
};

/** One row in `results.optionTotals` or `results.winners` (same shape in stored snapshots). */
export const pollResultOptionVotesRowV = v.object({
	optionIndex: v.number(),
	option: v.string(),
	/** Present for snapshots created after poll option descriptions; omit on older rows. */
	description: v.optional(v.nullable(v.string())),
	votes: v.number(),
});
