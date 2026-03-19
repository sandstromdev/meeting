import { zid } from 'convex-helpers/server/zod4';
import { query, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { authed } from './helpers/auth';
import { pickParticipantData } from './helpers/users';
import { z } from 'zod';
import type { Id } from './_generated/dataModel';
import type { UserIdentity } from 'convex/server';
import { hasRole } from '$lib/roles';

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await ctx.auth.getUserIdentity();

		if (!user) {
			return null;
		}

		return authComponent.getAuthUser(ctx);
	},
});

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
