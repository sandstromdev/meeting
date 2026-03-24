import { getRequestEvent } from '$app/server';
import { api } from '$convex/_generated/api';
import { type RequestEvent } from '@sveltejs/kit';
import { getConvexClient } from './convex';
import { assertAuthed } from './guards';

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

	return await client.query(api.me.getCurrentUser, {}).catch(() => null);
}
