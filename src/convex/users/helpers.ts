import {
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { mutation, query } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { AppError, errors } from '../error';
import { auth, authArgs } from '../auth.server';

export const userQuery = customQuery(
	query,
	customCtxAndArgs({
		args: authArgs,
		async input(ctx, args) {
			const data = await auth(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

export const userMutation = customMutation(
	mutation,
	customCtxAndArgs({
		args: authArgs,
		async input(ctx, args) {
			const data = await auth(ctx, args);
			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

export const participantMutation = customMutation(
	mutation,
	customCtxAndArgs({
		args: authArgs,
		async input(ctx, args) {
			const data = await auth(ctx, args);

			requireNotAbsent(data.user);

			return { ctx: { ...ctx, ...data }, args: {} };
		}
	})
);

export function requireNotAbsent<T extends Pick<Doc<'users'>, 'isAbsent'>>(
	user: T,
	action?: string
): asserts user is T & {
	isAbsent: false;
} {
	if (user.isAbsent) {
		throw new AppError(errors.illegal_while_absent(action));
	}
}
