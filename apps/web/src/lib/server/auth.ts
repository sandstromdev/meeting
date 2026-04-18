import { getRequestEvent } from '$app/server';
import { api } from '@lsnd-mt/convex/_generated/api';
import { type Handle, type RequestEvent } from '@sveltejs/kit';
import { getConvexClient } from './convex';
import { assertAuthed } from './guards';
import * as privateEnv from '$env/static/private';
import * as publicEnv from '$env/static/public';
import { getSecureCookieName } from '$lib/server/cookie';
import { getMeetingCookie } from '$lib/server/meeting-cookie';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';

export function getAuthedRequestEvent() {
	const event = getRequestEvent();

	assertAuthed(event.locals);

	return event as RequestEvent & {
		locals: App.Locals & { token: string };
	};
}

export async function getCurrentUser() {
	const client = getConvexClient();

	if (!getRequestEvent().locals.token) {
		return null;
	}

	return await client.query(api.app.me.getCurrentUser, {}).catch(() => null);
}

export const handleAuth = (async ({ event, resolve }) => {
	// Merge vite-loaded environment variables into process.env,
	// otherwise Better Auth will complain about missing variables.
	Object.assign(process.env, {
		...privateEnv,
		...publicEnv,
	});

	// Get the session token from the cookies.
	const sessionToken = event.cookies.get(getSecureCookieName('better-auth.session_token'));

	// Get the convex_jwt cookie from cookies.
	let token = getToken(event.cookies);

	// This is a workaround to not show the login page when the token is not found.
	// There are two tokens in cookies: session_token and convex_jwt. The convex_jwt has a short expiration time.
	// If the convex_jwt is not found, we try to get a new one from the session token.
	// This is handled on the client by the authClient, but not before the page is redirected to login.
	// This should be removed when the authClient is updated to handle this scenario.
	if (!token && sessionToken && event.route.id !== '/api/auth/[...all]') {
		const response = await event.fetch('/api/auth/get-session', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});

		// If the response is ok, get the token from the set-cookie header. If response is not ok, ignore the error.
		if (response.ok) {
			const cookie = response.headers
				.getSetCookie()
				.find((c) => c.startsWith(getSecureCookieName('better-auth.convex_jwt=')));
			token = cookie?.split('=').at(1)?.split(';').at(0);
		}
	}

	event.locals.token = token;
	event.locals.meetingId = getMeetingCookie(event.cookies);

	return withServerConvexToken(token, () => resolve(event));
}) satisfies Handle;
