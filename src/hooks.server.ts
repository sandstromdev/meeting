import { createAuth } from '$convex/auth';
import { getMeetingCookie } from '$lib/server/meeting-cookie';
import type { CreateAuth, GenericCtx } from '@convex-dev/better-auth';
import { JWT_COOKIE_NAME } from '@convex-dev/better-auth/plugins';
import { type Cookies, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createCookieGetter } from 'better-auth/cookies';
import type { GenericDataModel } from 'convex/server';

const log = false;

const auth: Handle = async ({ event, resolve }) => {
	if (log) {
		console.log({
			route: `[${event.request.method}] ${event.url.pathname} (${event.route.id})`,
			cookies: event.cookies.getAll().map((c) => c.name),
		});
	}

	event.locals.token = await getToken(createAuth, event.cookies);
	event.locals.meetingId = getMeetingCookie();

	if (event.locals.token == null) {
		return resolve(event);
	}

	// const client = getConvexClient(event.locals.token);

	// event.locals.currentUser = await client.query(api.auth.getCurrentUser, {}).catch(() => undefined);

	/* try {
		const data = await getMeetingData(event.locals.token);

		if (!data || !data.meeting || !data.me) {
			return resolve(event);
		}

		event.locals.meeting = data;
	} catch (e) {
		console.error('error getting meeting data', e);

		event.locals.meeting = undefined;
	} */

	return resolve(event);
};

export const handle = sequence(auth);

export const getToken = async <DataModel extends GenericDataModel>(
	createAuth: CreateAuth<DataModel>,
	cookies: Cookies,
) => {
	const options = createAuth({} as GenericCtx<DataModel>).options;
	const createCookie = createCookieGetter(options);
	const cookie = createCookie(JWT_COOKIE_NAME);
	const token = cookies.get(cookie.name);

	if (log) {
		console.log({
			options,
			cookie,
			token: token ? 'yes' : 'no',
		});
	}

	if (!token) {
		const isSecure = cookie.name.startsWith('__Secure-');
		const insecureCookieName = cookie.name.replace('__Secure-', '');
		const secureCookieName = isSecure ? cookie.name : `__Secure-${insecureCookieName}`;

		const insecureValue = cookies.get(insecureCookieName);
		const secureValue = cookies.get(secureCookieName);

		if (log) {
			console.log({
				insecureValue,
				secureValue,
			});
		}

		// If we expected secure and found insecure set
		if (isSecure && insecureValue) {
			console.warn(
				`Looking for secure cookie "${cookie.name}" but found insecure cookie "${insecureCookieName}".`,
			);
		}

		// If we expected insecure and found secure set
		if (!isSecure && secureValue) {
			console.warn(
				`Looking for insecure cookie "${cookie.name}" but found secure cookie "${secureCookieName}".`,
			);
		}
	}

	return token;
};
