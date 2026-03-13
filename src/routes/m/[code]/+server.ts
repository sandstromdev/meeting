import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/helpers/error';

import { PUBLIC_SITE_URL } from '$env/static/public';
import { getConvexClient } from '$lib/server/convex';
import { setMeetingCookie } from '$lib/server/meeting-cookie';
import { MeetingCode } from '$lib/validation';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { params, locals } = event;

	if (!locals.token) {
		redirect(303, `${PUBLIC_SITE_URL}/sign-in?redirect=${encodeURIComponent(`/m/${params.code}`)}`);
	}

	const parsed = MeetingCode.safeParse(params.code);

	if (!parsed.success) {
		redirect(303, `${PUBLIC_SITE_URL}/anslut?error=invalid_meeting_code&m=${params.code}`);
	}

	const convex = getConvexClient(event);

	try {
		const meetingId = await convex.mutation(api.users.auth.connect, {
			meetingCode: parsed.data,
		});

		setMeetingCookie(event, meetingId);
	} catch (e) {
		const err = getAppError(e);

		if (err) {
			redirect(303, `${PUBLIC_SITE_URL}/anslut?error=${err.code}&m=${parsed.data}`);
		}

		console.log(e);
		error(500);
	}

	redirect(303, '/');
};
