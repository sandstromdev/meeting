import { authComponent, createAuth } from '$convex/auth';
import type { Doc } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import { admin } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertPlatformAdmin,
	findAuthUserByEmail,
	getMeetingAccessMode,
	getMeetingParticipantByUserId,
	grantMeetingAccess,
	normalizeEmail,
	revokeMeetingAccess,
} from '$convex/helpers/meetingAccess';
import { ensureParticipantInMeeting } from '$convex/helpers/users';
import { ROLES, type Role } from '$lib/roles';
import { z } from 'zod';

const accessModeSchema = z.enum(['open', 'closed', 'invite_only']);
const roleSchema = z.enum(ROLES);

function generateRandomPassword() {
	return crypto.randomUUID().replaceAll('-', '');
}

type ImportMutationCtx = MutationCtx & {
	user: { subject: string; role: string };
	meeting: Doc<'meetings'>;
};

async function upsertMeetingUserFromImport(
	ctx: ImportMutationCtx,
	args: {
		email: string;
		name: string;
		role: Role;
		password?: string;
	},
) {
	const normalizedEmail = normalizeEmail(args.email);
	const password = args.password?.trim() || generateRandomPassword();
	const existingUser = await findAuthUserByEmail(ctx, normalizedEmail);
	const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

	let userId = existingUser?._id;
	let createdUser = false;
	let passwordUpdated = false;

	if (!userId) {
		try {
			const { user } = await auth.api.createUser({
				body: {
					email: normalizedEmail,
					name: args.name,
					password,
				},
				headers,
			});
			userId = user.id;
			createdUser = true;
		} catch (error) {
			const recoveredUser = await findAuthUserByEmail(ctx, normalizedEmail);
			if (!recoveredUser) {
				console.error(error);
				throw appErrors.internal_error();
			}
			userId = recoveredUser._id;
		}
	} else if (args.password?.trim()) {
		try {
			await auth.api.setUserPassword({
				body: {
					userId,
					newPassword: password,
				},
				headers,
			});
			passwordUpdated = true;
		} catch (error) {
			console.error(error);
			throw appErrors.internal_error();
		}
	}

	AppError.assertNotNull(userId, appErrors.internal_error());

	const existingParticipant = await getMeetingParticipantByUserId(ctx, ctx.meeting._id, userId);
	if (existingParticipant?.banned) {
		return {
			ok: false as const,
			email: normalizedEmail,
			name: args.name,
			role: args.role,
			userId,
			outcome: 'participant_banned' as const,
			createdUser,
			passwordUpdated,
			participantCreated: false,
			accessGranted: false,
			message: 'Anvandaren ar avstangd i det har motet.',
		};
	}

	await grantMeetingAccess(ctx, {
		meetingId: ctx.meeting._id,
		userId,
		email: normalizedEmail,
		addedByUserId: ctx.user.subject,
	});

	const result = await ensureParticipantInMeeting(ctx, {
		meeting: ctx.meeting,
		userId,
		name: args.name,
		role: args.role,
		requestReturnIfAbsent: false,
		syncExistingName: true,
		syncExistingRole: true,
	});

	if (!result.ok) {
		return {
			ok: false as const,
			email: normalizedEmail,
			name: args.name,
			role: args.role,
			userId,
			outcome: 'participant_banned' as const,
			createdUser,
			passwordUpdated,
			participantCreated: false,
			accessGranted: true,
			message: 'Anvandaren ar avstangd i det har motet.',
		};
	}

	return {
		ok: true as const,
		email: normalizedEmail,
		name: args.name,
		role: args.role,
		userId,
		outcome: existingParticipant ? 'already_in_meeting' : 'added_to_meeting',
		createdUser,
		passwordUpdated,
		participantCreated: !existingParticipant,
		accessGranted: true,
		message: existingParticipant
			? 'Anvandaren fanns redan i motet och uppdaterades vid behov.'
			: 'Anvandaren lades till i motet.',
	};
}

export const getSettings = admin.query().public(async ({ ctx }) => {
	return {
		accessMode: getMeetingAccessMode(ctx.meeting),
		canBulkImport: ctx.user.role === 'admin',
	};
});

export const getImportState = admin.query().public(async ({ ctx }) => {
	assertPlatformAdmin(ctx.user);

	const [participants, accessList] = await Promise.all([
		ctx.db
			.query('meetingParticipants')
			.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
			.take(1000),
		ctx.db
			.query('meetingAccessList')
			.withIndex('by_meetingId', (q) => q.eq('meetingId', ctx.meeting._id))
			.take(1000),
	]);

	return {
		accessMode: getMeetingAccessMode(ctx.meeting),
		participantUserIds: participants.map((participant) => participant.userId),
		accessListUserIds: accessList.flatMap((entry) => (entry.userId ? [entry.userId] : [])),
		accessListEmails: accessList.flatMap((entry) => (entry.email ? [entry.email] : [])),
	};
});

export const setMode = admin
	.mutation()
	.input({
		mode: accessModeSchema,
	})
	.public(async ({ ctx, args }) => {
		await ctx.db.patch('meetings', ctx.meeting._id, { accessMode: args.mode });
		return args.mode;
	});

export const addAllowedUser = admin
	.mutation()
	.input({
		userId: z.string().optional(),
		email: z.string().optional(),
	})
	.public(async ({ ctx, args }) => {
		const email = args.email?.trim();
		AppError.assert(
			args.userId !== undefined || (email !== undefined && email.length > 0),
			appErrors.bad_request({ reason: 'meeting_access_subject_required' }),
		);
		await grantMeetingAccess(ctx, {
			meetingId: ctx.meeting._id,
			userId: args.userId,
			email,
			addedByUserId: ctx.user.subject,
		});
		return true;
	});

export const removeAllowedUser = admin
	.mutation()
	.input({
		userId: z.string().optional(),
		email: z.string().optional(),
	})
	.public(async ({ ctx, args }) => {
		return await revokeMeetingAccess(ctx, {
			meetingId: ctx.meeting._id,
			userId: args.userId,
			email: args.email,
		});
	});

export const commitImportRow = admin
	.mutation()
	.input({
		email: z.string().email(),
		name: z.string().trim().min(1),
		role: roleSchema,
		password: z.string().min(4).optional(),
	})
	.public(async ({ ctx, args }) => {
		assertPlatformAdmin(ctx.user);
		return await upsertMeetingUserFromImport(ctx, args);
	});

export const createAndAddUser = admin
	.mutation()
	.input({
		email: z.string().email(),
		name: z.string().trim().min(1),
		role: roleSchema,
		password: z.string().min(4).optional(),
	})
	.public(async ({ ctx, args }) => {
		assertPlatformAdmin(ctx.user);
		return await upsertMeetingUserFromImport(ctx, args);
	});
