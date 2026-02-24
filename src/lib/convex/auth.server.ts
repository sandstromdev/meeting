import { AuthSchema } from '$lib/validation';
import { v } from 'convex/values';
import { jwtVerify, SignJWT } from 'jose';
import type { Id } from './_generated/dataModel';
import { AppError, Err } from './error';
import type { QueryCtx } from './_generated/server';

// oxlint-disable-next-line typescript/no-non-null-assertion
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export const authArgs = {
	tok: v.string()
};

export type AuthArgs = {
	tok: string;
};

export async function auth(ctx: QueryCtx, args: AuthArgs) {
	try {
		const res = await jwtVerify(args.tok, secret);

		const { userId, meetingId } = AuthSchema.parse(res.payload);

		const user = await ctx.db.get('users', userId);

		if (!user) {
			throw new AppError(Err.unauthorized);
		}

		if (user.meetingId !== meetingId) {
			throw new AppError(Err.forbidden);
		}

		const meeting = await ctx.db.get('meetings', meetingId);

		if (!meeting) {
			throw new AppError(Err.meeting_not_found({ meetingId }));
		}

		return { user, meeting };
	} catch {
		throw new AppError(Err.unauthorized);
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
