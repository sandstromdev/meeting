import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { api } from '$lib/convex/_generated/api';
import { error, redirect, type Cookies, type Handle, type RequestEvent } from '@sveltejs/kit';
import { getConvexClient } from './convex';

const cookieName = 'auth';

type UserData = NonNullable<App.Locals['user']>;

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

async function getAuth(event: RequestEvent) {
	const tok = event.cookies.get(cookieName);

	if (!tok) {
		deleteCookie(event.cookies);
		return null;
	}

	try {
		const user = await getConvexClient().query(api.users.auth.getUserData, { tok });

		return user;
	} catch {
		deleteCookie(event.cookies);
		return null;
	}
}

export type AuthOptions = {
	admin?: boolean;
};

export function assertAuthed(
	user: UserData | undefined,
	opts: AuthOptions = {}
): asserts user is UserData {
	if (!user) {
		error(401);
	}

	if (opts.admin) {
		if (opts.admin !== user.admin) {
			error(403);
		}
	}
}

export function getAuthedRequestEvent(opts: AuthOptions = {}) {
	const event = getRequestEvent();

	assertAuthed(event.locals.user, opts);

	// oxlint-disable-next-line no-unsafe-type-assertion
	return event as RequestEvent & {
		locals: App.Locals & { user: UserData };
	};
}

export const handleAuth = (async ({ event, resolve }) => {
	const user = await getAuth(event);

	if (event.url.pathname.startsWith('/anslut')) {
		if (!user) {
			return resolve(event);
		}

		redirect(303, '/');
	}

	if (!user) {
		redirect(303, '/anslut');
	}

	event.locals.user = user;

	return resolve(event);
}) satisfies Handle;
