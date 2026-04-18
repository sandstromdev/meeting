import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, '../..');

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	root: appRoot,
	server: {
		fs: {
			// Allow only the monorepo paths we intentionally import from.
			allow: [
				appRoot,
				path.resolve(repoRoot, 'apps/convex'),
				path.resolve(repoRoot, 'packages/common'),
				path.resolve(repoRoot, 'node_modules'),
			],
		},
	},
	test: {
		passWithNoTests: false,
		projects: [
			{
				extends: true,
				test: {
					name: 'app',
					include: ['src/**/*.test.{ts,js}'],
					environment: 'node',
				},
			},
		],
	},
});
