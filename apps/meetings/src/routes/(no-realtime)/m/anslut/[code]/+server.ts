import { api } from '@lsnd-mt/convex/_generated/api';
import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';

import { PUBLIC_SITE_URL } from '$env/static/public';
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
			`${PUBLIC_SITE_URL}/sign-in?redirect=${encodeURIComponent(`/m/anslut/${params.code}`)}`,
		);
	}

	const parsed = MeetingCode.safeParse(params.code);

	if (!parsed.success) {
		redirect(307, `${PUBLIC_SITE_URL}/m/anslut?error=invalid_meeting_code&m=${params.code}`);
	}

	const convex = getConvexClient();

	try {
		const meetingId = await convex.mutation(api.meeting.users.auth.connect, {
			meetingCode: parsed.data,
		});

		setMeetingCookie(event.cookies, meetingId);
	} catch (e) {
		const err = (() => {
			const convexErr = getAppError(e);
			return convexErr ? AppError.fromJSON(convexErr.toJSON()) : null;
		})();

		if (err) {
			redirect(307, `${PUBLIC_SITE_URL}/m/anslut?error=${err.code}&m=${parsed.data}`);
		}

		console.log(e);
		error(500);
	}

	redirect(307, '/m');
};
