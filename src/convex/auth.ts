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
	authFunctions,
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
	return {
		baseURL: getSiteUrl(),
		trustedOrigins: getTrustedOrigins(),
		secret: getSecret(),

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

function getSiteUrl() {
	const siteUrl = process.env.PUBLIC_BETTER_AUTH_URL || process.env.PUBLIC_SITE_URL;

	if (!siteUrl) {
		throw new Error('PUBLIC_BETTER_AUTH_URL or PUBLIC_SITE_URL is not set');
	}

	return siteUrl;
}

function getTrustedOrigins() {
	return [
		getSiteUrl(),
		process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
		process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: undefined,
		process.env.PUBLIC_CONVEX_SITE_URL,
		process.env.TRUSTED_ORIGINS?.split(';').map((origin) => origin.trim()),
	].filter(Boolean) as string[];
}

function getSecret() {
	if (!process.env.BETTER_AUTH_SECRET) {
		throw new Error('BETTER_AUTH_SECRET is not set');
	}

	return process.env.BETTER_AUTH_SECRET;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
	return betterAuth(createAuthOptions(ctx));
}

export const options = createAuthOptions({} as GenericCtx<DataModel>);
