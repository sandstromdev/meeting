import { components } from '$convex/_generated/api';
import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import { AppError, appErrors } from './error';

export const MEETING_ACCESS_MODES = ['open', 'closed', 'invite_only'] as const;
export type MeetingAccessMode = (typeof MEETING_ACCESS_MODES)[number];

type AuthLookupCtx = {
	runQuery: QueryCtx['runQuery'];
};

export function getMeetingAccessMode(
	meeting: Pick<Doc<'meetings'>, 'accessMode'>,
): MeetingAccessMode {
	return meeting.accessMode ?? 'open';
}

export function assertPlatformAdmin(user: { role?: string | null }) {
	AppError.assert(user.role === 'admin', appErrors.forbidden());
}

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export async function findAuthUserByEmail(ctx: AuthLookupCtx, email: string) {
	return await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'user',
		where: [{ field: 'email', value: normalizeEmail(email) }],
	});
}

export async function getMeetingParticipantByUserId(
	ctx: QueryCtx | MutationCtx,
	meetingId: Id<'meetings'>,
	userId: string,
) {
	return await ctx.db
		.query('meetingParticipants')
		.withIndex('by_user_meeting', (q) => q.eq('userId', userId).eq('meetingId', meetingId))
		.first();
}

export async function hasMeetingAccessByUserId(
	ctx: QueryCtx | MutationCtx,
	meetingId: Id<'meetings'>,
	userId: string,
) {
	return (
		(await ctx.db
			.query('meetingAccessList')
			.withIndex('by_meetingId_and_userId', (q) =>
				q.eq('meetingId', meetingId).eq('userId', userId),
			)
			.first()) !== null
	);
}

export async function hasMeetingAccessByEmail(
	ctx: QueryCtx | MutationCtx,
	meetingId: Id<'meetings'>,
	email: string,
) {
	return (
		(await ctx.db
			.query('meetingAccessList')
			.withIndex('by_meetingId_and_email', (q) =>
				q.eq('meetingId', meetingId).eq('email', normalizeEmail(email)),
			)
			.first()) !== null
	);
}

export async function grantMeetingAccess(
	ctx: MutationCtx,
	args: {
		meetingId: Id<'meetings'>;
		userId?: string;
		email?: string;
		addedByUserId: string;
	},
) {
	const normalizedEmail = args.email ? normalizeEmail(args.email) : undefined;
	AppError.assert(
		args.userId !== undefined || normalizedEmail !== undefined,
		appErrors.bad_request({ reason: 'meeting_access_subject_required' }),
	);

	const [userMatches, emailMatches] = await Promise.all([
		args.userId
			? ctx.db
					.query('meetingAccessList')
					.withIndex('by_meetingId_and_userId', (q) =>
						q.eq('meetingId', args.meetingId).eq('userId', args.userId!),
					)
					.collect()
			: Promise.resolve([]),
		normalizedEmail
			? ctx.db
					.query('meetingAccessList')
					.withIndex('by_meetingId_and_email', (q) =>
						q.eq('meetingId', args.meetingId).eq('email', normalizedEmail),
					)
					.collect()
			: Promise.resolve([]),
	]);

	const primary = userMatches[0] ?? emailMatches[0];
	const duplicateIds = new Set(
		[...userMatches, ...emailMatches].map((entry) => entry._id).filter((id) => id !== primary?._id),
	);

	if (primary) {
		const patch: Partial<Doc<'meetingAccessList'>> = {};
		if (args.userId !== undefined && primary.userId !== args.userId) {
			patch.userId = args.userId;
		}
		if (normalizedEmail !== undefined && primary.email !== normalizedEmail) {
			patch.email = normalizedEmail;
		}
		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(primary._id, patch);
		}
		for (const duplicateId of duplicateIds) {
			await ctx.db.delete(duplicateId);
		}
		return primary._id;
	}

	return await ctx.db.insert('meetingAccessList', {
		meetingId: args.meetingId,
		...(args.userId !== undefined ? { userId: args.userId } : {}),
		...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
		addedByUserId: args.addedByUserId,
		addedAt: Date.now(),
	});
}

export async function revokeMeetingAccess(
	ctx: MutationCtx,
	args: {
		meetingId: Id<'meetings'>;
		userId?: string;
		email?: string;
	},
) {
	const normalizedEmail = args.email ? normalizeEmail(args.email) : undefined;
	if (args.userId === undefined && normalizedEmail === undefined) {
		return 0;
	}

	const [userMatches, emailMatches] = await Promise.all([
		args.userId
			? ctx.db
					.query('meetingAccessList')
					.withIndex('by_meetingId_and_userId', (q) =>
						q.eq('meetingId', args.meetingId).eq('userId', args.userId!),
					)
					.collect()
			: Promise.resolve([]),
		normalizedEmail
			? ctx.db
					.query('meetingAccessList')
					.withIndex('by_meetingId_and_email', (q) =>
						q.eq('meetingId', args.meetingId).eq('email', normalizedEmail),
					)
					.collect()
			: Promise.resolve([]),
	]);

	const ids = new Set([...userMatches, ...emailMatches].map((entry) => entry._id));
	for (const id of ids) {
		await ctx.db.delete(id);
	}
	return ids.size;
}

export async function canUserJoinMeeting(
	ctx: QueryCtx | MutationCtx,
	args: {
		meeting: Pick<Doc<'meetings'>, '_id' | 'accessMode'>;
		userId: string;
		email?: string;
	},
): Promise<{
	allowed: boolean;
	mode: MeetingAccessMode;
	via: 'open' | 'participant' | 'access_list' | 'denied';
}> {
	const mode = getMeetingAccessMode(args.meeting);

	if (mode === 'open') {
		return { allowed: true, mode, via: 'open' };
	}

	const participant = await getMeetingParticipantByUserId(ctx, args.meeting._id, args.userId);
	if (participant && !(participant.banned ?? false)) {
		return { allowed: true, mode, via: 'participant' };
	}

	if (await hasMeetingAccessByUserId(ctx, args.meeting._id, args.userId)) {
		return { allowed: true, mode, via: 'access_list' };
	}

	if (args.email && (await hasMeetingAccessByEmail(ctx, args.meeting._id, args.email))) {
		return { allowed: true, mode, via: 'access_list' };
	}

	return { allowed: false, mode, via: 'denied' };
}
