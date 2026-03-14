import { query } from './_generated/server';
import { authComponent } from './better-auth';

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
