import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex as betterAuthConvex } from '@convex-dev/better-auth/plugins';
import { components } from './_generated/api';
import { query } from './_generated/server';
import { betterAuth } from 'better-auth/minimal';
import authConfig from './auth.config';
import type { DataModel } from './_generated/dataModel';

// oxlint-disable-next-line typescript/no-non-null-assertion
const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		baseURL: siteUrl,
		database: authComponent.adapter(ctx),

		// session: {
		// 	cookieCache: {
		// 		enabled: true,
		// 		maxAge: 60 * 5
		// 	}
		// },

		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			minPasswordLength: 4,
		},
		plugins: [betterAuthConvex({ authConfig })],
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
