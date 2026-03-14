import { createAuth } from '$convex/auth';
import { env } from '$env/dynamic/public';
import { getMeetingCookie } from '$lib/server/meeting-cookie';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
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

	process.env.PUBLIC_SITE_URL = env.PUBLIC_SITE_URL;

	event.locals.token = await getToken(createAuth, event.cookies);
	event.locals.meetingId = getMeetingCookie();

	return resolve(event);
};

export const handle = sequence(auth);
