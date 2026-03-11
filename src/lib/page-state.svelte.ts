import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { z } from 'zod';

export function setParam(key: keyof Params, value: Params[keyof Params]) {
	if (!browser) {
		return;
	}

	const sp = page.url.searchParams;
	sp.set(key, value);

	// eslint-disable-next-line svelte/no-navigation-without-resolve
	goto('?' + sp.toString(), {});
}
export function usePageState() {
	const params = $derived(validateSearchParams(page.url));

	return {
		get view() {
			return params.view;
		},
		set view(value: View) {
			setParam('view', value);
		},

		get projectorMode() {
			return params.projectorMode;
		},
		set projectorMode(value: ProjectorMode) {
			setParam('projectorMode', value);
		},

		get isProjector() {
			return params.view === 'projector';
		},
		get isQueue() {
			return params.view === 'queue';
		},
		get isDefault() {
			return params.view === 'default';
		},
	};
}

export function validateSearchParams(url: URL) {
	const parsed = ParamsSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
	return parsed.success ? parsed.data : ParamsSchema.parse({});
}

export const ParamsSchema = z.object({
	view: z.enum(['projector', 'queue', 'default']).catch('default'),
	projectorMode: z.enum(['intro', 'meeting']).catch('meeting'),
});

export type Params = z.infer<typeof ParamsSchema>;
export type View = Params['view'];
export type ProjectorMode = Params['projectorMode'];
