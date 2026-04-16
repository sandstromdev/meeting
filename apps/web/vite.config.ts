import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	envDir: '../..',
	plugins: [tailwindcss(), sveltekit()],
	test: {
		passWithNoTests: false,
		name: 'app',
		include: ['src/**/*.test.{ts,js}'],
		environment: 'node',
	},
});
