import { zid } from 'convex-helpers/server/zod4';
import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { authComponent, createAuth } from './auth';
import { appErrors, getAppError } from './helpers/error';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
	path: '/api/meeting/snapshot',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		const url = new URL(req.url);
		const meetingIdParam = zid('meetings').safeParse(url.searchParams.get('meetingId'));
		if (!meetingIdParam.success) {
			return appErrors
				.bad_request({
					meetingId: meetingIdParam.error.message,
				})
				.toJsonResponse();
		}

		const meetingId = meetingIdParam.data;

		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return appErrors.unauthorized().toJsonResponse();
		}

		try {
			const payload = await ctx.runQuery(
				internal.meeting.jobs.snapshots.getMeetingSnapshotForExport,
				{
					meetingId: meetingId,
					tokenIdentifier: identity.subject,
				},
			);
			if (payload === null) {
				return appErrors.meeting_not_found({ meetingId }).toJsonResponse();
			}
			return Response.json(payload);
		} catch (e) {
			const err = getAppError(e);
			if (err) {
				return err.toJsonResponse();
			}
			console.error('Internal error:', e);
			return appErrors.internal_error().toJsonResponse();
		}
	}),
});

export default http;
