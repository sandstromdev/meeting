import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { api } from '$convex/_generated/api';
import { createAuth } from '$convex/auth.js';
import { getToken } from '@mmailaender/convex-better-auth-svelte/sveltekit';
import { error, redirect, type Cookies, type Handle, type RequestEvent } from '@sveltejs/kit';
import { getConvexClient } from './convex';

const cookieName = 'auth';

export async function setAuth(token: string) {
	const event = getRequestEvent();

	event.cookies.set(cookieName, token, {
		path: '/',
		maxAge: 60 * 60 * 24 * 3,
		secure: !dev,
		httpOnly: true,
		sameSite: 'lax'
	});
}

function deleteCookie(cookies: Cookies) {
	cookies.set(cookieName, '', {
		httpOnly: true,
		path: '/',
		secure: !dev,
		sameSite: 'lax',
		maxAge: 0
	});
}

export async function getUser(event: RequestEvent) {
	if (!event.locals.token || !event.locals.meetingId) {
		return null;
	}

	try {
		const user = await getConvexClient().query(api.users.auth.getUserData, {
			meetingId: event.locals.meetingId
		});

		return user;
	} catch {
		deleteCookie(event.cookies);
		return null;
	}
}

export function assertAuthed(locals: App.Locals): asserts locals is App.Locals & { token: string } {
	if (!locals.token) {
		error(401);
	}
}

export function getAuthedRequestEvent() {
	const event = getRequestEvent();

	assertAuthed(event.locals);

	// oxlint-disable-next-line no-unsafe-type-assertion
	return event as RequestEvent & {
		locals: App.Locals & { token: string };
	};
}

export const handleAuth = (async ({ event, resolve }) => {
	event.locals.token = await getToken(createAuth, event.cookies);

	return resolve(event);
}) satisfies Handle;

export function redirectIfAuthed(to: string, status: 307 | 303 = 307) {
	const event = getRequestEvent();

	if (event.locals.token) {
		redirect(status, to);
	}
}

export function redirectIfNotAuthed(to: string, status: 307 | 303 = 307) {
	const event = getRequestEvent();

	if (!event.locals.token) {
		redirect(status, to);
	}
}
