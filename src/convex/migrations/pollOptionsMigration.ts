import { Migrations } from '@convex-dev/migrations';
import { components } from '../_generated/api';
import { internalMutation } from '../_generated/server';

/**
 * Migrates legacy `options: string[]` on polls and embedded `poll` snapshots to
 * `{ title, description }[]` (description `null`). Safe to re-run; skips already-migrated docs.
 *
 * Run each migration (e.g. from dashboard or CLI) until finished:
 *
 *   bunx convex run pollOptionsMigration:runPollOptionsMigrations \
 *     '{"fn":"pollOptionsMigration:migrateMeetingPollOptions"}'
 *   bunx convex run pollOptionsMigration:runPollOptionsMigrations \
 *     '{"fn":"pollOptionsMigration:migrateUserPollOptions"}'
 *   bunx convex run pollOptionsMigration:runPollOptionsMigrations \
 *     '{"fn":"pollOptionsMigration:migrateMeetingPollResultSnapshots"}'
 *   bunx convex run pollOptionsMigration:runPollOptionsMigrations \
 *     '{"fn":"pollOptionsMigration:migrateUserPollResultSnapshots"}'
 *
 * Use `dryRun: true` on the runner args when supported to validate before writing.
 */
export const migrations = new Migrations(components.migrations, { internalMutation });

export const runPollOptionsMigrations = migrations.runner();

function optionsNeedMigration(options: unknown): options is string[] {
	return (
		Array.isArray(options) && options.length > 0 && options.every((x) => typeof x === 'string')
	);
}

function stringOptionsToRows(options: string[]) {
	return options.map((title) => ({ title, description: null as string | null }));
}

export const migrateMeetingPollOptions = migrations.define({
	table: 'meetingPolls',
	migrateOne: async (ctx, doc) => {
		if (!optionsNeedMigration(doc.options)) {
			return;
		}
		await ctx.db.patch(doc._id, { options: stringOptionsToRows(doc.options) });
	},
});

export const migrateUserPollOptions = migrations.define({
	table: 'userPolls',
	migrateOne: async (ctx, doc) => {
		if (!optionsNeedMigration(doc.options)) {
			return;
		}
		await ctx.db.patch(doc._id, { options: stringOptionsToRows(doc.options) });
	},
});

export const migrateMeetingPollResultSnapshots = migrations.define({
	table: 'meetingPollResults',
	migrateOne: async (ctx, doc) => {
		const poll = doc.poll;
		if (!optionsNeedMigration(poll.options)) {
			return;
		}
		const newOptions = stringOptionsToRows(poll.options);
		const descriptionAt = (optionIndex: number) => newOptions[optionIndex]?.description ?? null;

		await ctx.db.patch(doc._id, {
			poll: { ...poll, options: newOptions },
			results: {
				...doc.results,
				optionTotals: doc.results.optionTotals.map((row) => ({
					...row,
					description: descriptionAt(row.optionIndex),
				})),
				winners: doc.results.winners.map((row) => ({
					...row,
					description: descriptionAt(row.optionIndex),
				})),
			},
		});
	},
});

export const migrateUserPollResultSnapshots = migrations.define({
	table: 'userPollResults',
	migrateOne: async (ctx, doc) => {
		const poll = doc.poll;
		if (!optionsNeedMigration(poll.options)) {
			return;
		}
		const newOptions = stringOptionsToRows(poll.options);
		const descriptionAt = (optionIndex: number) => newOptions[optionIndex]?.description ?? null;

		await ctx.db.patch(doc._id, {
			poll: { ...poll, options: newOptions },
			results: {
				...doc.results,
				optionTotals: doc.results.optionTotals.map((row) => ({
					...row,
					description: descriptionAt(row.optionIndex),
				})),
				winners: doc.results.winners.map((row) => ({
					...row,
					description: descriptionAt(row.optionIndex),
				})),
			},
		});
	},
});
