import { PUBLIC_CONVEX_URL } from '$env/static/public';
import {
	decodeConvexLoad,
	encodeConvexLoad,
	initConvex,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport } from '@sveltejs/kit';

initConvex(PUBLIC_CONVEX_URL);

export const transport = {
	ConvexLoadResult: {
		encode: (value) => encodeConvexLoad(value),
		decode: (encoded) => decodeConvexLoad(encoded),
	},
} satisfies Transport;
