import { zid } from 'convex-helpers/server/zod4';
import type { UserIdentity } from 'convex/server';
import type { QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from './error';
import { c } from './index';
import { getMeetingParticipant } from './meeting';
import { normalizeAgendaItems } from './agenda';

export const authMw = c.$context<QueryCtx>().createMiddleware(async ({ ctx, next }) => {
	const user = await ctx.auth.getUserIdentity();

	if (!user) {
		console.log('unauthorized:', user);
		throw new AppError(errors.unauthorized);
	}

	return next({ ...ctx, user: user as UserIdentity & { name: string } });
});

export const authed = c.use(authMw);

export const withMeeting = authed
	.input({
		meetingId: zid('meetings'),
	})
	.use(async ({ ctx, args, next }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);

		if (!meeting) {
			throw new AppError(errors.meeting_not_found(args));
		}

		meeting.agenda = normalizeAgendaItems(meeting.agenda);

		return next({ ...ctx, meeting });
	});

export const withMe = withMeeting.use(async ({ ctx, args, next }) => {
	const me = await getMeetingParticipant(ctx, args.meetingId);

	if (!me) {
		throw new AppError(errors.forbidden);
	}

	return next({ ...ctx, me });
});

export const admin = withMe.use(({ ctx, next }) => {
	if (!ctx.me.isAdmin) {
		throw new AppError(errors.forbidden);
	}

	return next(ctx);
});
