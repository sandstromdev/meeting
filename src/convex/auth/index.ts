import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { components } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import authConfig from '../auth.config';
import schema from './schema';

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
	local: { schema },
	verbose: false,
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	const siteUrl = process.env.PUBLIC_SITE_URL;

	if (!siteUrl) {
		console.error('SITE_URL is not set');
	}

	return {
		baseURL: siteUrl,

		database: authComponent.adapter(ctx),

		trustedOrigins: [
			siteUrl,
			process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
			process.env.VERCEL_PROJECT_PRODUCTION_URL
				? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
				: undefined,
			process.env.PUBLIC_CONVEX_SITE_URL,
		].filter(Boolean) as string[],

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 4,
			disableSignUp: true,
		},

		plugins: [convex({ authConfig })],
	} satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx));
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);
