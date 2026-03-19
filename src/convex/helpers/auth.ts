import { zid } from 'convex-helpers/server/zod4';
import type { UserIdentity } from 'convex/server';
import type { QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from './error';
import { c } from './index';
import { getMeetingParticipant } from './meeting';

export type Identity = UserIdentity & { name: string; role: 'admin' | 'user' };

export const authMw = c.$context<QueryCtx>().createMiddleware(async ({ ctx, next }) => {
	const user = await ctx.auth.getUserIdentity();

	if (!user) {
		console.log('unauthorized:', user);
		throw new AppError(errors.unauthorized);
	}

	return next({ ...ctx, user: Object.assign(user, { role: user.role ?? 'user' }) as Identity });
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

		return next({ ...ctx, meeting });
	});

export const withMe = withMeeting.use(async ({ ctx, args, next }) => {
	const me = await getMeetingParticipant(ctx, args.meetingId);

	if (!me) {
		throw new AppError(errors.forbidden);
	}

	return next({ ...ctx, me });
});

export const moderator = withMe.use(({ ctx, next }) => {
	if (ctx.me.role === 'participant' || ctx.me.role === 'adjuster') {
		throw new AppError(errors.forbidden);
	}

	return next(ctx);
});

export const admin = withMe.use(({ ctx, next }) => {
	if (ctx.me.role !== 'admin') {
		throw new AppError(errors.forbidden);
	}

	return next(ctx);
});
