import { zid } from 'convex-helpers/server/zod4';
import { query, type QueryCtx } from './_generated/server';
import { authComponent } from './auth';
import { authed } from './helpers/auth';
import { pickParticipantData } from './helpers/users';
import { z } from 'zod';
import type { Id } from './_generated/dataModel';
import type { UserIdentity } from 'convex/server';

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await ctx.auth.getUserIdentity();

		if (!user) {
			return undefined;
		}

		return authComponent.getAuthUser(ctx);
	},
});

async function getMeetingParticipantInner(
	ctx: QueryCtx & { user: UserIdentity },
	meetingId: Id<'meetings'>,
) {
	const me = await ctx.db
		.query('meetingParticipants')
		.withIndex('by_token_meeting', (q) =>
			q.eq('tokenIdentifier', ctx.user.tokenIdentifier).eq('meetingId', meetingId),
		)
		.first();

	if (!me) {
		return undefined;
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
	.input({ meetingId: zid('meetings'), role: z.enum(['admin', 'moderator', 'participant']) })
	.public(async ({ ctx, args }) => {
		const me = await getMeetingParticipantInner(ctx, args.meetingId);

		if (!me) {
			return false;
		}

		const hierarchy: Record<string, number> = { admin: 2, moderator: 1, participant: 0 };
		return (hierarchy[me.role] ?? 0) >= (hierarchy[args.role] ?? 0);
	});
