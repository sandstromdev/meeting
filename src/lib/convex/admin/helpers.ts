import {
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { mutation, query, type QueryCtx } from '../_generated/server';
import { AppError, Err } from '../error';
import { auth, authArgs, type AuthArgs } from '../auth.server';

async function authAdmin(ctx: QueryCtx, args: AuthArgs) {
	const data = await auth(ctx, args);

	if (!data.user.admin) {
		throw new AppError(Err.unauthorized);
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
