import { query } from '@lsnd/convex/_generated/server';
import { authComponent } from '@lsnd/convex/auth';

// --- Public queries ---

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const user = await ctx.auth.getUserIdentity();

		if (!user) {
			return null;
		}

		return authComponent.getAuthUser(ctx);
	},
});
