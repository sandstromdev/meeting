import { api } from '$convex/_generated/api';
import { getAppError } from '$convex/helpers/error';
import type { Id } from '$convex/_generated/dataModel';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { getConvexClient } from '$lib/server/convex';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';

/**
 * Shared meeting-route auth: Convex Better Auth session + meeting cookie.
 */
export function requireMeetingRouteAuth(locals: App.Locals) {
	const authState = getAuthState();

	if (!authState.isAuthenticated) {
		redirect(307, '/sign-in');
	}

	if (!locals.meetingId) {
		redirect(307, '/m/anslut');
	}
}

type MeetingLoadLocals = App.Locals;

/**
 * Loads meeting data via SvelteKit convexLoad (realtime route tree).
 */
export async function loadMeetingWithConvexLoad(event: {
	locals: MeetingLoadLocals;
	cookies: Cookies;
}) {
	requireMeetingRouteAuth(event.locals);

	let meeting;

	try {
		meeting = await convexLoad(
			api.meeting.users.meeting.getData,
			{ meetingId: event.locals.meetingId as Id<'meetings'> },
			{ token: event.locals.token },
		);
	} catch (e) {
		const err = getAppError(e);

		if (
			err?.is('meeting_not_found') ||
			err?.is('meeting_participant_not_found') ||
			err?.is('participant_banned') ||
			err?.is('meeting_archived')
		) {
			deleteMeetingCookie(event.cookies);

			const message = err?.is('participant_banned') || err?.is('meeting_archived');

			redirect(307, message ? `/m/anslut?error=${err.code}` : '/m/anslut');
		}

		console.error(e);

		error(500);
	}

	return meeting;
}

/**
 * Loads meeting data via HTTP Convex client (no-realtime / simplified route tree).
 * Uses the same token context as other server Convex calls.
 */
export async function loadMeetingWithHttpClient(event: {
	locals: MeetingLoadLocals;
	cookies: Cookies;
}) {
	requireMeetingRouteAuth(event.locals);

	const meetingId = event.locals.meetingId as Id<'meetings'>;

	try {
		return await getConvexClient().query(api.meeting.users.meeting.getData, { meetingId });
	} catch (e) {
		const err = getAppError(e);

		if (
			err?.is('meeting_not_found') ||
			err?.is('meeting_participant_not_found') ||
			err?.is('participant_banned') ||
			err?.is('meeting_archived')
		) {
			deleteMeetingCookie(event.cookies);

			const message = err?.is('participant_banned') || err?.is('meeting_archived');

			redirect(307, message ? `/m/anslut?error=${err.code}` : '/m/anslut');
		}

		console.error(e);

		error(500);
	}
}

/**
 * Sends admins/moderators away from participant-only paths.
 * `me` is the current meeting participant row from `getData` (or `convexLoad` → `meeting.data.me`).
 */
export function redirectNonParticipantsFromPaths(
	url: URL,
	me: { role: string } | null | undefined,
) {
	if (!me) {
		return;
	}

	const role = me.role;

	if (url.pathname === '/m' || url.pathname === '/m/simplified') {
		if (role === 'admin') {
			redirect(307, '/m/admin');
		}

		if (role === 'moderator') {
			redirect(307, '/m/moderator');
		}
	}
}
