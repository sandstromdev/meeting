import { assertAuthed } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals }) => {
	assertAuthed(locals.user);

	return {};
}) satisfies LayoutServerLoad;
