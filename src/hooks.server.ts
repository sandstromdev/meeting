import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth';
import { getConvexClient } from '$lib/server/convex';
import { getMeetingCookie, getMeetingData } from '$lib/server/meeting-cookie';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const auth: Handle = async ({ event, resolve }) => {
	const client = getConvexClient();

	event.locals.token = await getToken(createAuth, event.cookies);
	event.locals.meetingId = getMeetingCookie();

	if (event.route.id?.startsWith('/(form)/sign') || event.route.id?.startsWith('/api')) {
		return resolve(event);
	}

	if (event.locals.token) {
		client.setAuth(event.locals.token);

		event.locals.currentUser = await client
			.query(api.auth.getCurrentUser, {})
			.catch(() => undefined);
	}

	if (event.route.id === '/(form)/anslut') {
		return resolve(event);
	}

	try {
		const data = await getMeetingData();

		if (!data || !data.meeting || !data.me) {
			return resolve(event);
		}

		event.locals.meeting = data;
	} catch {
		event.locals.meeting = undefined;
	}

	return resolve(event);
};

export const handle = sequence(auth);
