import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { RequestEvent } from '@sveltejs/kit';
import { getConvexClient } from './convex';

const cookieName = 'meeting-id';

export function setMeetingCookie(event: RequestEvent, meetingId: Id<'meetings'>) {
	event.cookies.set(cookieName, meetingId, {
		path: '/',
		secure: !dev,
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 2,
		sameSite: 'lax',
	});
}

export function getMeetingCookie() {
	const event = getRequestEvent();

	const id = event.cookies.get(cookieName);

	return id as Id<'meetings'> | undefined;
}

export function deleteMeetingCookie(event?: RequestEvent) {
	event ??= getRequestEvent();

	event.cookies.set(cookieName, '', {
		path: '/',
		secure: !dev,
		httpOnly: true,
		maxAge: 0,
		sameSite: 'lax',
	});
}

export async function getMeeting() {
	const meetingId = getMeetingCookie();

	if (!meetingId) {
		return null;
	}

	const convex = getConvexClient();

	return convex.query(api.meetings.getMeetingById, { meetingId });
}

export async function getMeetingData() {
	const meetingId = getMeetingCookie();

	if (!meetingId) {
		return null;
	}

	const convex = getConvexClient();

	return convex.query(api.users.meeting.getData, { meetingId }).catch(() => null);
}
