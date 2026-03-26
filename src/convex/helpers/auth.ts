import { zid } from 'convex-helpers/server/zod4';
import type { UserIdentity } from 'convex/server';
import type { QueryCtx } from '$convex/_generated/server';
import { AppError, appErrors } from './error';
import { c } from './index';
import { getMeetingParticipant } from './meeting';
import { assertMeetingNotArchived } from './meetingLifecycle';

export type Identity = UserIdentity & { name: string; role: 'admin' | 'user' };

export const authMw = c.$context<QueryCtx>().createMiddleware(async ({ ctx, next }) => {
	const user = await ctx.auth.getUserIdentity();

	if (!user) {
		console.log('unauthorized:', user);
	}
	AppError.assertNotNull(user, appErrors.unauthorized());

	return next({ ...ctx, user: Object.assign(user, { role: user.role ?? 'user' }) as Identity });
});

export const authed = c.use(authMw);

export const withMeeting = authed
	.input({
		meetingId: zid('meetings'),
	})
	.use(async ({ ctx, args, next }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);

		AppError.assertNotNull(meeting, appErrors.meeting_not_found(args));
		assertMeetingNotArchived(meeting);

		return next({ ...ctx, meeting });
	});

export const withMe = withMeeting.use(async ({ ctx, args, next }) => {
	const me = await getMeetingParticipant(ctx, args.meetingId);

	AppError.assertNotNull(me, appErrors.forbidden());

	return next({ ...ctx, me });
});

export const moderator = withMe.use(({ ctx, next }) => {
	AppError.assert(
		ctx.me.role !== 'participant' && ctx.me.role !== 'adjuster',
		appErrors.forbidden(),
	);

	return next(ctx);
});

export const admin = withMe.use(({ ctx, next }) => {
	AppError.assert(ctx.me.role === 'admin', appErrors.forbidden());

	return next(ctx);
});
