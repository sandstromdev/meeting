import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '$convex/_generated/api';
import type { DataModel } from '$convex/_generated/dataModel';
import { internalMutation } from '$convex/_generated/server';

/**
 * `multi_winner` with winningCount 1 is equivalent to `single_winner` + relative majority
 * (plurality). Migrate stored polls and embedded poll snapshots for consistency.
 */
function isMultiWinnerSingleSeat(poll: { type: string; winningCount?: number }): boolean {
	return poll.type === 'multi_winner' && poll.winningCount === 1;
}

const migrations = new Migrations<DataModel>(components.migrations, {
	internalMutation,
});

export const migrateMeetingPollsMultiWinnerCount1ToSingleRelative = migrations.define({
	table: 'meetingPolls',
	migrateOne: async (ctx, doc) => {
		if (!isMultiWinnerSingleSeat(doc)) {
			return;
		}
		await ctx.db.patch(doc._id, {
			type: 'single_winner',
			majorityRule: 'relative',
			winningCount: 1,
			maxVotesPerVoter: 1,
		});
	},
});

export const migrateUserPollsMultiWinnerCount1ToSingleRelative = migrations.define({
	table: 'userPolls',
	migrateOne: async (ctx, doc) => {
		if (!isMultiWinnerSingleSeat(doc)) {
			return;
		}
		await ctx.db.patch(doc._id, {
			type: 'single_winner',
			majorityRule: 'relative',
			winningCount: 1,
			maxVotesPerVoter: 1,
		});
	},
});

export const migrateMeetingPollResultsEmbeddedPollMultiWinnerCount1 = migrations.define({
	table: 'meetingPollResults',
	migrateOne: async (ctx, doc) => {
		if (!isMultiWinnerSingleSeat(doc.poll)) {
			return;
		}
		await ctx.db.patch(doc._id, {
			poll: {
				...doc.poll,
				type: 'single_winner',
				majorityRule: 'relative',
				winningCount: 1,
				maxVotesPerVoter: 1,
			},
			results: {
				...doc.results,
				majorityRule: 'relative',
			},
		});
	},
});

export const migrateUserPollResultsEmbeddedPollMultiWinnerCount1 = migrations.define({
	table: 'userPollResults',
	migrateOne: async (ctx, doc) => {
		if (!isMultiWinnerSingleSeat(doc.poll)) {
			return;
		}
		await ctx.db.patch(doc._id, {
			poll: {
				...doc.poll,
				type: 'single_winner',
				majorityRule: 'relative',
				winningCount: 1,
				maxVotesPerVoter: 1,
			},
			results: {
				...doc.results,
				majorityRule: 'relative',
			},
		});
	},
});

/** Run all four steps in order (safe to re-run; already-migrated docs are no-ops). */
export const runMultiWinnerCount1ToSingleRelativeSeries = migrations.runner([
	internal.migrations.migrateMeetingPollsMultiWinnerCount1ToSingleRelative,
	internal.migrations.migrateUserPollsMultiWinnerCount1ToSingleRelative,
	internal.migrations.migrateMeetingPollResultsEmbeddedPollMultiWinnerCount1,
	internal.migrations.migrateUserPollResultsEmbeddedPollMultiWinnerCount1,
]);

export const migrateIsResultPublicToResultVisibility = migrations.define({
	table: 'userPolls',
	migrateOne: async (ctx, doc) => {
		if (doc.isResultPublic !== undefined) {
			await ctx.db.patch(doc._id, {
				resultVisibility: doc.isResultPublic ? 'full' : 'none',
			});
		}
	},
});

export const migrateMeetingPollIsResultPublicToResultVisibility = migrations.define({
	table: 'meetingPolls',
	migrateOne: async (ctx, doc) => {
		if (doc.isResultPublic !== undefined) {
			await ctx.db.patch(doc._id, {
				resultVisibility: doc.isResultPublic ? 'full' : 'none',
			});
		}
	},
});

export const runIsResultPublicToResultVisibilitySeries = migrations.runner([
	internal.migrations.migrateIsResultPublicToResultVisibility,
	internal.migrations.migrateMeetingPollIsResultPublicToResultVisibility,
]);
