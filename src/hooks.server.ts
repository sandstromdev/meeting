import { dev } from '$app/environment';
import { createAuth } from '$convex/auth';
import { env } from '$env/dynamic/public';
import { ENVIRONMENT, TRUSTED_ORIGINS } from '$env/static/private';
import { authClient } from '$lib/auth-client';
import { getMeetingCookie } from '$lib/server/meeting-cookie';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { withServerConvexToken } from '@mmailaender/convex-svelte/sveltekit/server';
import { json, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const log = false;

const auth: Handle = async ({ event, resolve }) => {
	if (log) {
		console.log({
			route: `[${event.request.method}] ${event.url.pathname} (${event.route.id})`,
			cookies: event.cookies.getAll().map((c) => c.name),
		});
	}

	process.env.PUBLIC_SITE_URL = env.PUBLIC_SITE_URL;
	process.env.TRUSTED_ORIGINS = TRUSTED_ORIGINS;
	process.env.ENVIRONMENT = ENVIRONMENT;

	const sessionToken = event.cookies.get('better-auth.session_token');
	const token = await getToken(createAuth, event.cookies);

	if (!token && sessionToken && event.route.id !== '/api/auth/[...all]') {
		await event.fetch('/api/auth/get-session', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});
	}

	event.locals.token = token;
	event.locals.meetingId = getMeetingCookie(event.cookies);

	return withServerConvexToken(token, () => resolve(event));
};

export const handle = sequence(auth);
