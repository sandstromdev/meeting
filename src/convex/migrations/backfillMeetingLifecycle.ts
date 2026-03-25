import { c } from '$convex/helpers';
import type { Doc } from '$convex/_generated/dataModel';
import { z } from 'zod';

const DEFAULT_MEETING_TIMEZONE = 'Europe/Stockholm';

type LegacyMeetingDoc = Partial<Doc<'meetings'>>;

/** Local to migration: tolerate pre-narrow docs if this ever runs again on partial rows. */
function statusForBackfill(m: LegacyMeetingDoc): NonNullable<LegacyMeetingDoc['status']> {
	const s = m.status;
	if (s === 'draft' || s === 'scheduled' || s === 'active' || s === 'closed' || s === 'archived') {
		return s;
	}
	return m.isOpen ? 'active' : 'closed';
}

export const backfillMeetingLifecyclePage = c
	.mutation()
	.input({
		batchSize: z.number().int().min(1).max(100).default(25),
		cursor: z.union([z.string(), z.null()]).optional(),
		defaultTimezone: z.string().trim().min(1).default(DEFAULT_MEETING_TIMEZONE),
		fallbackCreatedByUserId: z.string().trim().min(1).default('legacy:unknown'),
	})
	.internal(async ({ ctx, args }) => {
		const cursor = args.cursor ?? null;
		const page = await ctx.db.query('meetings').paginate({
			numItems: args.batchSize,
			cursor,
		});

		let patched = 0;
		for (const meeting of page.page) {
			const legacy = meeting as LegacyMeetingDoc;
			let createdByUserId = legacy.createdByUserId;

			if (!createdByUserId) {
				const participants = await ctx.db
					.query('meetingParticipants')
					.withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
					.take(100);
				createdByUserId =
					participants.find((participant) => participant.role === 'admin')?.userId ??
					participants[0]?.userId ??
					args.fallbackCreatedByUserId;
			}

			const nextStatus = statusForBackfill(legacy);
			const nextTimezone = legacy.timezone?.trim() ? legacy.timezone : args.defaultTimezone;
			const nextLocation = legacy.location?.trim() ? legacy.location : undefined;
			const nextDescription = legacy.description?.trim() ? legacy.description : undefined;

			const needsPatch =
				legacy.status !== nextStatus ||
				legacy.timezone !== nextTimezone ||
				legacy.createdByUserId !== createdByUserId ||
				legacy.location !== nextLocation ||
				legacy.description !== nextDescription;

			if (!needsPatch) {
				continue;
			}

			const patch: Partial<Doc<'meetings'>> = {
				status: nextStatus,
				timezone: nextTimezone,
				createdByUserId,
			};
			if (nextLocation) {
				patch.location = nextLocation;
			}
			if (nextDescription) {
				patch.description = nextDescription;
			}

			await ctx.db.patch('meetings', meeting._id, {
				...patch,
			});
			patched += 1;
		}

		return {
			processed: page.page.length,
			patched,
			isDone: page.isDone,
			continueCursor: page.continueCursor,
		};
	});
