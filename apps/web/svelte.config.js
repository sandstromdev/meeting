import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),

		experimental: {
			remoteFunctions: true,
		},
		alias: {
			'@lsnd/convex': '../convex/src/convex',
		},
	},
	compilerOptions: {
		experimental: {
			async: true,
		},
	},
};

export default config;
