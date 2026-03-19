import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/helpers/error';

import { env } from '$env/dynamic/public';
import { setMeetingCookie } from '$lib/server/meeting-cookie';
import { MeetingCode } from '$lib/validation';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConvexClient } from '$lib/server/convex';

export const GET: RequestHandler = async (event) => {
	const { params, locals } = event;

	if (!locals.token) {
		redirect(
			307,
			`${env.PUBLIC_SITE_URL}/sign-in?redirect=${encodeURIComponent(`/anslut/${params.code}`)}`,
		);
	}

	const parsed = MeetingCode.safeParse(params.code);

	if (!parsed.success) {
		redirect(307, `${env.PUBLIC_SITE_URL}/anslut?error=invalid_meeting_code&m=${params.code}`);
	}

	const convex = getConvexClient();

	try {
		const meetingId = await convex.mutation(api.users.auth.connect, {
			meetingCode: parsed.data,
		});

		setMeetingCookie(event.cookies, meetingId);
	} catch (e) {
		const err = getAppError(e);

		if (err) {
			redirect(307, `${env.PUBLIC_SITE_URL}/anslut?error=${err.code}&m=${parsed.data}`);
		}

		console.log(e);
		error(500);
	}

	redirect(307, '/m');
};
