import { getRequestEvent } from '$app/server';
import { error, redirect } from '@sveltejs/kit';

export function redirectIfInMeeting(to: string, status: 307 | 303 = 307) {
	const event = getRequestEvent();

	if (event.locals.meetingId) {
		redirect(status, to);
	}
}

export function redirectIfNotInMeeting(to: string, status: 307 | 303 = 307) {
	const event = getRequestEvent();

	if (!event.locals.meetingId) {
		redirect(status, to);
	}
}

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

export function assertAuthed(locals: App.Locals): asserts locals is App.Locals & { token: string } {
	if (!locals.token) {
		error(401);
	}
}
