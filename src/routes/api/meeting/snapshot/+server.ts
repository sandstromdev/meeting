import { PUBLIC_CONVEX_SITE_URL } from '$env/static/public';
import { AppError, errors } from '$convex/helpers/error';
import { MeetingSnapshotSchema } from '$lib/validation';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET = (async ({ locals, fetch }) => {
	if (!locals.token) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!locals.meetingId) {
		return new Response('Meeting not found', { status: 404 });
	}

	const url = `${PUBLIC_CONVEX_SITE_URL}/api/meeting/snapshot?meetingId=${encodeURIComponent(locals.meetingId)}`;

	try {
		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${locals.token}`,
				Accept: 'application/json',
			},
		});

		const text = await res.text();

		if (!res.ok) {
			return new Response(text, {
				status: res.status,
				headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
			});
		}

		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return new AppError(errors.internal_error).toResponse('json');
		}

		const parsed = MeetingSnapshotSchema.safeParse(body);

		if (!parsed.success) {
			console.error('Meeting snapshot schema mismatch', parsed.error);
			return new AppError(errors.internal_error).toResponse('json');
		}

		return json(parsed.data);
	} catch (error) {
		console.error('Internal error:', error);
		return new AppError(errors.internal_error).toResponse('json');
	}
}) satisfies RequestHandler;
