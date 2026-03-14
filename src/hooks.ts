import { env } from '$env/dynamic/public';
import {
	decodeConvexLoad,
	encodeConvexLoad,
	initConvex,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport } from '@sveltejs/kit';

initConvex(env.PUBLIC_CONVEX_URL);

export const transport = {
	ConvexLoadResult: {
		encode: (value) => encodeConvexLoad(value),
		decode: (encoded) => decodeConvexLoad(encoded),
	},
} satisfies Transport;
