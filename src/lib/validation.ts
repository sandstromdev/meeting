import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const MeetingCode = z
	.string()
	.length(6)
	.regex(/[0-9a-zA-Z]{6}/);

export const AuthSchema = z.object({
	userId: zid('users'),
	meetingId: zid('meetings')
});
