import { c } from '$convex/helpers';
import { PollEmbeddedSnapshotSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import * as z from 'zod';

export const moveOldMeetingPolls = c
	.mutation()
	.input({ meetingId: zid('meetings') })
	.internal(async ({ ctx, args }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);

		if (!meeting) {
			throw new Error('Meeting not found');
		}

		const newAgenda = meeting.agenda;

		for (let i = 0; i < meeting.agenda.length; i++) {
			const item = meeting.agenda[i];
			newAgenda[i].pollIds = await Promise.all(
				item.pollIds.map(async (pid) => {
					// @ts-expect-error - polls table is not defined anymore
					const poll = await ctx.db.get('polls', pid);
					if (!poll) {
						throw new Error('Poll not found');
					}

					const validated = PollEmbeddedSnapshotSchema.safeParse(poll);

					if (!validated.success) {
						throw new Error('Invalid poll. ' + z.prettifyError(validated.error));
					}

					const id = await ctx.db.insert('meetingPolls', {
						...validated.data,
					});

					return id;
				}),
			);
		}

		await ctx.db.patch('meetings', args.meetingId, { agenda: newAgenda });
	});
