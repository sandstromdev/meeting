import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { betterAuth } from 'better-auth/minimal';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { query } from './_generated/server';
import authConfig from './auth.config';

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	let siteUrl = process.env.PUBLIC_SITE_URL;

	if (!siteUrl) {
		console.error('SITE_URL is not set');
	}

	return betterAuth({
		baseURL: siteUrl,

		database: authComponent.adapter(ctx),

		trustedOrigins: ['http://localhost:4000', 'http://192.168.0.169:4000'],

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 4,
		},

		plugins: [convex({ authConfig })],
	});
};

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await ctx.auth.getUserIdentity();

		if (!user) {
			return undefined;
		}

		return authComponent.getAuthUser(ctx);
	},
});
