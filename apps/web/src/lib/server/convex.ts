import { createConvexHttpClient as createConvexHttpClientInner } from '@mmailaender/convex-better-auth-svelte/sveltekit';

export function getConvexClient() {
	return createConvexHttpClientInner();
}
