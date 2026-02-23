import {
	customCtxAndArgs,
	customMutation,
	customQuery
} from 'convex-helpers/server/customFunctions';
import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { auth, authArgs } from '../helpers';
import type { Doc } from '../_generated/dataModel';

export const userQuery = customQuery(
	query,
	customCtxAndArgs({
		args: {
			userId: v.id('users'),
			meetingCode: v.string()
		},
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
	message?: string
): asserts user is {
	[P in keyof T]: T[P];
} & {
	isAbsent: false;
} {
	if (user.isAbsent) {
		throw new Error(message ?? 'Cannot do this while absent.');
	}
}
