import type { Auth } from 'convex/server';
import { v, type ObjectType } from 'convex/values';
import { SignJWT } from 'jose';
import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { AppError, errors } from './error';
import { convex } from './helpers.server';

// oxlint-disable-next-line typescript/no-non-null-assertion
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export const authArgs = {
	meetingId: v.id('meetings')
};

export type AuthArgs = ObjectType<typeof authArgs>;

export async function auth(ctx: QueryCtx, args: AuthArgs) {
	try {
		const u = await ctx.auth.getUserIdentity();

		if (!u) {
			throw new AppError(errors.unauthorized);
		}

		const user = await ctx.db
			.query('users')
			.withIndex('by_token_meeting', (q) =>
				q.eq('tokenIdentifier', u.tokenIdentifier).eq('meetingId', args.meetingId)
			)
			.first();

		if (!user) {
			throw new AppError(errors.forbidden);
		}

		const meeting = await ctx.db.get('meetings', user.meetingId);

		if (!meeting) {
			throw new AppError(errors.meeting_not_found({ meetingId: user.meetingId }));
		}

		return { user, meeting };
	} catch {
		throw new AppError(errors.unauthorized);
	}
}

const JWT_PROTECTED_HEADER = { alg: 'HS256' };

export async function signJWT(userId: Id<'users'>, meetingId: Id<'meetings'>) {
	return await new SignJWT({
		userId,
		meetingId
	})
		.setProtectedHeader(JWT_PROTECTED_HEADER)
		.setIssuedAt()
		.setExpirationTime('2s')
		.sign(secret);
}

export const authMiddleware = convex
	.$context<{ auth: Auth }>()
	.createMiddleware(async (ctx, next) => {
		const u = await ctx.auth.getUserIdentity();

		if (!u) {
			throw new AppError(errors.unauthorized);
		}

		return next(ctx);
	});

export const authedQuery = convex.query().use(authMiddleware);
export const authedMutation = convex.query().use(authMiddleware);
