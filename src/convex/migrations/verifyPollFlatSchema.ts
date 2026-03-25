import type { Doc } from '$convex/_generated/dataModel';
import { c } from '$convex/helpers';
import {
	FullPollSchema,
	FullUserPollSchema,
	PollEmbeddedSnapshotSchema,
	UserPollEmbeddedSnapshotSchema,
} from '$lib/validation';
import { z } from 'zod';

function formatZodErr(err: z.ZodError): string {
	return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/**
 * One paginated batch: validates stored poll shapes after flattening `type` + optional branch fields.
 * Run repeatedly with `continueCursor` until `isDone` (per `table`).
 */
export const verifyPollFlatSchemaPage = c
	.mutation()
	.input({
		table: z.enum(['meetingPolls', 'userPolls', 'meetingPollResults', 'userPollResults']),
		batchSize: z.number().int().min(1).max(250).default(100),
		cursor: z.union([z.string(), z.null()]).optional(),
	})
	.internal(async ({ ctx, args }) => {
		const cursor = args.cursor === undefined ? null : args.cursor;
		const page = await ctx.db.query(args.table).paginate({
			numItems: args.batchSize,
			cursor,
		});

		let ok = 0;
		let invalid = 0;
		const sampleErrors: string[] = [];

		for (const doc of page.page) {
			let parsed: z.ZodSafeParseResult<unknown>;
			switch (args.table) {
				case 'meetingPolls':
					parsed = FullPollSchema.safeParse(doc);
					break;
				case 'userPolls':
					parsed = FullUserPollSchema.safeParse(doc);
					break;
				case 'meetingPollResults':
					parsed = PollEmbeddedSnapshotSchema.safeParse((doc as Doc<'meetingPollResults'>).poll);
					break;
				case 'userPollResults':
					parsed = UserPollEmbeddedSnapshotSchema.safeParse((doc as Doc<'userPollResults'>).poll);
					break;
			}

			if (parsed.success) {
				ok += 1;
			} else {
				invalid += 1;
				if (sampleErrors.length < 5) {
					sampleErrors.push(`${doc._id}: ${formatZodErr(parsed.error)}`);
				}
			}
		}

		return {
			ok,
			invalid,
			processed: page.page.length,
			continueCursor: page.continueCursor,
			isDone: page.isDone,
			sampleErrors,
		};
	});
