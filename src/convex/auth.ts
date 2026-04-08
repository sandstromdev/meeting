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

		trustedOrigins: getTrustedOrigins(),

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

const UNSAFE_ORIGIN_REGEX = /localhost|127\.0\.0\.1/;

export function getTrustedOrigins() {
	const origins = [
		process.env.PUBLIC_BETTER_AUTH_URL || process.env.PUBLIC_SITE_URL,
		process.env.PUBLIC_CONVEX_SITE_URL,
		...(process.env.TRUSTED_ORIGINS?.split(';').map((origin) => origin.trim()) || []),
	].filter(Boolean) as string[];

	const set = new Set<string>();

	for (const origin of origins) {
		set.add(origin);
		if (process.env.ENVIRONMENT !== 'development' && UNSAFE_ORIGIN_REGEX.test(origin)) {
			console.warn('Found localhost in trusted origins:', origin);
			console.warn('This is not recommended for production environments.');
		}
	}

	return [...set];
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
