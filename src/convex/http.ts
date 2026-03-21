import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { AppError, errors, getAppError } from './helpers/error';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
	path: '/api/meeting/snapshot',
	method: 'GET',
	handler: httpAction(async (ctx, req) => {
		const url = new URL(req.url);
		const meetingIdParam = url.searchParams.get('meetingId');
		if (!meetingIdParam) {
			return new Response(
				JSON.stringify({
					error: {
						code: 'invalid_args',
						status: 400,
						message: 'meetingId query parameter is required',
					},
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return new Response('Unauthorized', { status: 401 });
		}

		try {
			const payload = await ctx.runQuery(internal.backup.getMeetingSnapshotForExport, {
				meetingId: meetingIdParam as Id<'meetings'>,
				tokenIdentifier: identity.subject,
			});
			if (payload === null) {
				const err = new AppError(
					errors.meeting_not_found({ meetingId: meetingIdParam as Id<'meetings'> }),
				);
				return new Response(JSON.stringify({ error: { ...err.data, message: err.message } }), {
					status: err.status,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			return Response.json(payload);
		} catch (e) {
			const app = getAppError(e);
			if (app) {
				return new Response(JSON.stringify({ error: { ...app.data, message: app.message } }), {
					status: app.status,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			console.error(e);
			return new Response(JSON.stringify({ error: { code: 'internal_error', status: 500 } }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}),
});

export default http;
