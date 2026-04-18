import * as privateEnv from '$env/static/private';
import * as publicEnv from '$env/static/public';
import type { Handle } from '@sveltejs/kit';

/** Merges Vite-loaded env into `process.env` for libraries that read from Node at request time. */
export const handle: Handle = async ({ event, resolve }) => {
	Object.assign(process.env, {
		...privateEnv,
		...publicEnv,
	});
	return resolve(event);
};
