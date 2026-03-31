import { createAuth } from '$convex/auth';
import * as privateEnv from '$env/static/private';
import * as publicEnv from '$env/static/public';
import { getSecureCookieName } from '$lib/server/cookie';
import { getMeetingCookie } from '$lib/server/meeting-cookie';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';
import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const log = false;

const auth: Handle = async ({ event, resolve }) => {
	if (log) {
		console.log({
			route: `[${event.request.method}] ${event.url.pathname} (${event.route.id})`,
			cookies: event.cookies.getAll().map((c) => c.name),
		});
	}

	Object.assign(process.env, {
		...privateEnv,
		...publicEnv,
	});

	const sessionToken = event.cookies.get(getSecureCookieName('better-auth.session_token'));
	let token = await getToken(createAuth, event.cookies);

	if (!token && sessionToken && event.route.id !== '/api/auth/[...all]') {
		const response = await event.fetch('/api/auth/get-session', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});

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
};

export const handle = sequence(auth);
