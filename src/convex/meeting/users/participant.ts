import { zid } from 'convex-helpers/server/zod4';
import type { QueryCtx } from '$convex/_generated/server';
import type { Id } from '$convex/_generated/dataModel';
import { authed } from '$convex/helpers/auth';
import { pickParticipantData } from '$convex/helpers/users';
import { hasRole } from '$lib/roles';
import type { UserIdentity } from 'convex/server';
import { z } from 'zod';

async function getMeetingParticipantInner(
	ctx: QueryCtx & { user: UserIdentity },
	meetingId: Id<'meetings'>,
) {
	const userId = ctx.user.subject;
	const me = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_user_meeting', (q) => q.eq('userId', userId).eq('meetingId', meetingId))
		.first();

	if (!me) {
		return null;
	}

	return pickParticipantData(me);
}

// --- Public queries ---

export const getMeetingParticipant = authed
	.query()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		return getMeetingParticipantInner(ctx, args.meetingId);
	});

/** Hierarchical role check: admin satisfies any role, moderator satisfies moderator+participant. */
export const hasAtLeastRole = authed
	.query()
	.input({
		meetingId: zid('meetings'),
		role: z.enum(['admin', 'moderator', 'participant', 'adjuster']),
	})
	.public(async ({ ctx, args }) => {
		const me = await getMeetingParticipantInner(ctx, args.meetingId);

		if (!me) {
			return false;
		}

		return hasRole(me.role, args.role);
	});
