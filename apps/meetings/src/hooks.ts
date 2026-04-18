import { AppError } from '@lsnd-mt/common/appError';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import {
	decodeConvexLoad,
	encodeConvexLoad,
	initConvex,
} from '@mmailaender/convex-svelte/sveltekit';
import type { Transport, Transporter } from '@sveltejs/kit';

initConvex(PUBLIC_CONVEX_URL);

export const transport = {
	ConvexLoadResult: {
		encode: (value) => encodeConvexLoad(value),
		decode: (encoded) => decodeConvexLoad(encoded),
	},
	AppError: {
		encode: (value) =>
			value && typeof value === 'object' && 'toJSON' in value
				? (value as { toJSON: () => unknown }).toJSON()
				: false,
		decode: (encoded) => AppError.fromJSON(encoded),
	} satisfies Transporter<AppError>,
} satisfies Transport;
