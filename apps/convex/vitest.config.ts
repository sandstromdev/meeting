import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@lsnd/convex': path.resolve(import.meta.dirname, './src/convex'),
			$lib: path.resolve(import.meta.dirname, '../web/src/lib'),
		},
	},
	test: {
		passWithNoTests: false,
		name: 'convex',
		include: ['src/convex/**/*.test.{ts,js}'],
		environment: 'edge-runtime',
	},
});
