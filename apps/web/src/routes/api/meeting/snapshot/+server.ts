import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';
import { appErrors, getAppError } from '@lsnd/convex/helpers/error';
import { MeetingSnapshotSchema } from '$lib/validation';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async ({ locals, fetch }) => {
	if (!locals.token) {
		return appErrors.unauthorized().toJsonResponse();
	}

	if (!locals.meetingId) {
		return appErrors.meeting_not_found({ meetingId: locals.meetingId }).toJsonResponse();
	}

	const url = `${PUBLIC_CONVEX_SITE_URL}/api/meeting/snapshot?meetingId=${encodeURIComponent(locals.meetingId)}`;

	try {
		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${locals.token}`,
				Accept: 'application/json',
			},
		});

		if (!res.ok) {
			return new Response(await res.text(), {
				status: res.status,
				headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
			});
		}

		const body = await res.json();

		const parsed = MeetingSnapshotSchema.safeParse(body);

		if (!parsed.success) {
			console.error('Meeting snapshot schema mismatch', parsed.error);
			return appErrors.internal_error().toJsonResponse();
		}

		return json(parsed.data);
	} catch (error) {
		const appError = getAppError(error);
		if (appError) {
			return appError.toJsonResponse();
		}
		console.error('Internal error:', error);
		const internal = appErrors.internal_error();
		return json(internal.toJSON(), { status: internal.status });
	}
}) satisfies RequestHandler;
