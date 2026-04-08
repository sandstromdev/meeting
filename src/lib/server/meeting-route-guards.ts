import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { getAppError } from '$convex/helpers/error';
import { deleteMeetingCookie } from '$lib/server/meeting-cookie';
import { getAuthState } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import type { Cookies } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';

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

	try {
		return await convexLoad(
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

	if (url.pathname === '/m') {
		if (role === 'admin') {
			redirect(307, '/m/admin');
		}

		if (role === 'moderator') {
			redirect(307, '/m/moderator');
		}
	}
}
