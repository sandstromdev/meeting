import { createClient, type AuthFunctions, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal';
import { admin } from 'better-auth/plugins';
import { components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import authConfig from './auth.config';
import authSchema from './betterAuth/schema';

const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	local: {
		schema: authSchema,
	},
	verbose: process.env.BETTER_AUTH_VERBOSE === 'true',
	authFunctions,
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
	return {
		baseURL: process.env.PUBLIC_BETTER_AUTH_URL || process.env.PUBLIC_SITE_URL,

		trustedOrigins: [
			process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
			process.env.VERCEL_PROJECT_PRODUCTION_URL
				? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
				: undefined,
			process.env.PUBLIC_CONVEX_SITE_URL,
			process.env.TRUSTED_ORIGINS?.split(';').map((origin) => origin.trim()),
		].filter(Boolean) as string[],

		secret: process.env.BETTER_AUTH_SECRET,

		database: authComponent.adapter(ctx),

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 4,
			disableSignUp: process.env.PUBLIC_ENABLE_SIGNUP !== 'true',
		},

		plugins: [convex({ authConfig }), admin()],
	} satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
	const opts = createAuthOptions(ctx);

	if (!opts.secret) {
		console.error('BETTER_AUTH_SECRET is not set');
	}

	if (!opts.baseURL) {
		console.error('PUBLIC_BETTER_AUTH_URL or PUBLIC_SITE_URL is not set');
	}

	return betterAuth(opts);
}

export const options = createAuthOptions({} as GenericCtx<DataModel>);
