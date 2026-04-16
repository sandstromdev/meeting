import { dev } from '$app/environment';
import { api } from '@lsnd/convex/_generated/api';
import type { Id } from '@lsnd/convex/_generated/dataModel';
import type { Cookies } from '@sveltejs/kit';
import { getConvexClient } from './convex';

const cookieName = 'meeting-id';

export function setMeetingCookie(cookies: Cookies, meetingId: Id<'meetings'>) {
	cookies.set(cookieName, meetingId, {
		path: '/',
		secure: !dev,
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 2,
		sameSite: 'lax',
	});
}

export function getMeetingCookie(cookies: Cookies) {
	const id = cookies.get(cookieName);

	return id as Id<'meetings'> | undefined;
}

export function deleteMeetingCookie(cookies: Cookies) {
	cookies.set(cookieName, '', {
		path: '/',
		secure: !dev,
		httpOnly: true,
		maxAge: 0,
		sameSite: 'lax',
	});
}

export async function getMeeting(cookies: Cookies) {
	const meetingId = getMeetingCookie(cookies);

	if (!meetingId) {
		return null;
	}

	const convex = getConvexClient();

	return convex.query(api.meeting.public.meetings.getMeetingById, { meetingId });
}

export async function getMeetingData(cookies: Cookies) {
	const meetingId = getMeetingCookie(cookies);

	if (!meetingId) {
		return null;
	}

	const convex = getConvexClient();

	return convex.query(api.meeting.users.meeting.getData, { meetingId }).catch(() => null);
}
