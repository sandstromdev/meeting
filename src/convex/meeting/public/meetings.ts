import { MeetingCode } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { authed } from '$convex/helpers/auth';
import { c } from '$convex/helpers';
import { getMeetingByCode } from '$convex/helpers/meeting';

// --- Public queries ---

export const getMeetingById = authed
	.query()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => ctx.db.get('meetings', args.meetingId));

export const findByCode = c
	.query()
	.input({ meetingCode: MeetingCode })
	.public(async ({ ctx, args: { meetingCode } }) => getMeetingByCode(ctx, meetingCode));
