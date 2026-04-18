import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			$convex: path.resolve(__dirname, 'src'),
		},
	},
	test: {
		passWithNoTests: false,
		include: ['src/**/*.test.{ts,js}'],
		environment: 'edge-runtime',
	},
});
