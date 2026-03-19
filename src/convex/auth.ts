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
	// verbose: true,
	authFunctions,
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	const siteUrl = process.env.PUBLIC_SITE_URL;

	if (!siteUrl) {
		// console.error('PUBLIC_SITE_URL is not set');
	}

	const trustedOrigins = [
		siteUrl,
		process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
		process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: undefined,
		process.env.PUBLIC_CONVEX_SITE_URL,
		process.env.TRUSTED_ORIGINS?.split(';').map((origin) => origin.trim()),
	].filter(Boolean) as string[];

	return {
		baseURL: siteUrl,

		database: authComponent.adapter(ctx),

		trustedOrigins,

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 4,
			disableSignUp: true,
		},

		plugins: [convex({ authConfig }), admin()],
	} satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx));
};

export const options = createAuthOptions({} as GenericCtx<DataModel>);
