import { getRequestEvent } from '$app/server';
import { type RequestEvent } from '@sveltejs/kit';
import { assertAuthed } from './guards';
import { getConvexClient } from '$lib/server/convex';
import { api } from '$convex/_generated/api';

export function getAuthedRequestEvent() {
	const event = getRequestEvent();

	assertAuthed(event.locals);

	return event as RequestEvent & {
		locals: App.Locals & { token: string };
	};
}

export async function getCurrentUser() {
	const event = getAuthedRequestEvent();
	const client = getConvexClient(event);

	return await client.query(api.me.getCurrentUser, {}).catch(() => undefined);
}
