import {
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { mutation, query, type QueryCtx } from '../_generated/server';
import { authArgs, auth, type AuthArgs } from '../helpers';

async function authAdmin(ctx: QueryCtx, args: AuthArgs) {
	const data = await auth(ctx, args);

	if (!data.user.admin) {
		throw new Error('Unauthorized');
	}

	return data;
}

export const adminQuery = customQuery(
	query,
	customCtxAndArgs({
		args: authArgs,
		async input(ctx, args) {
			const data = await authAdmin(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

export const adminMutation = customMutation(
	mutation,
	customCtxAndArgs({
		args: authArgs,
		async input(ctx, args) {
			const data = await authAdmin(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);
