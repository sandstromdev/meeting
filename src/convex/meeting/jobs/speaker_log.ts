import { c } from '$convex/helpers';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const logSpeaker = c
	.mutation()
	.input({
		type: z.enum(['point_of_order', 'reply', 'speaker']),
		by: z.object({
			userId: zid('meetingParticipants'),
			name: z.string(),
		}),
		startTime: z.number(),
		endTime: z.number(),
		meetingId: zid('meetings'),
	})
	.internal(async ({ ctx, args }) => {
		const { db } = ctx;
		const { type, by, startTime, endTime, meetingId } = args;

		await db.insert('speakerLogEntries', {
			meetingId,
			type,
			userId: by.userId,
			name: by.name,
			startTime,
			endTime,
		});
	});
