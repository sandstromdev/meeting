import path from 'node:path';
import { fileURLToPath } from 'node:url';

import adapter from '@sveltejs/adapter-vercel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),

		experimental: {
			remoteFunctions: true,
		},

		alias: {
			$convex: path.resolve(__dirname, '../convex/src'),
			'@lsnd-mt/convex': path.resolve(__dirname, '../convex/src'),
			'@lsnd-mt/common': path.resolve(__dirname, '../../packages/common/src'),
		},
	},
	compilerOptions: {
		experimental: {
			async: true,
		},
	},
};

export default config;
