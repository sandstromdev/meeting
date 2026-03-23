import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		passWithNoTests: false,
		projects: [
			{
				extends: true,
				test: {
					name: 'convex',
					include: ['src/convex/**/*.test.{ts,js}'],
					environment: 'edge-runtime',
				},
			},
			{
				extends: true,
				test: {
					name: 'app',
					include: ['src/**/*.test.{ts,js}'],
					exclude: ['src/convex/**'],
					environment: 'node',
				},
			},
		],
	},
});
