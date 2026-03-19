import { authComponent, createAuth } from '$convex/auth';
import { authed } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import * as z from 'zod';

const admin = authed.use(async ({ ctx, next }) => {
	AppError.assert(ctx.user.role === 'admin', errors.forbidden);
	return next(ctx);
});

export const createUser = admin
	.mutation()
	.input({
		email: z.string(),
		name: z.string(),
		password: z.string(),
	})
	.public(async ({ ctx, args }) => {
		const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
		try {
			const { user } = await auth.api.createUser({
				body: { email: args.email, name: args.name, password: args.password },
				headers,
			});

			return user.id;
		} catch (error) {
			console.error(error);
			throw new AppError(errors.internal_error);
		}
	});
