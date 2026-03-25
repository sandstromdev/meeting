import { authed } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import { deriveMeetingStatus, effectiveMeetingTimezone } from '$convex/helpers/meetingLifecycle';
import { applyNewParticipantSideEffects, insertMeetingParticipant } from '$convex/helpers/users';
import type { QueryCtx } from '$convex/_generated/server';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

const MeetingStatusSchema = z.enum(['draft', 'scheduled', 'active', 'closed', 'archived']);

const platformAdmin = authed.use(async ({ ctx, next }) => {
	AppError.assert(ctx.user.role === 'admin', appErrors.forbidden());
	return next(ctx);
});

function normalizeOptionalText(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

async function nextMeetingCode(db: QueryCtx['db']): Promise<string> {
	const maxAttempts = 20;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const code = Math.floor(Math.random() * 1_000_000)
			.toString()
			.padStart(6, '0');
		const existing = await db
			.query('meetings')
			.withIndex('by_code', (q) => q.eq('code', code))
			.first();
		if (!existing) {
			return code;
		}
	}
	throw appErrors.internal_error();
}

function assertMeetingOwner(createdByUserId: string | undefined, currentUserId: string) {
	AppError.assert(createdByUserId === currentUserId, appErrors.forbidden());
}

// --- Public queries ---

export const listForCurrentUser = platformAdmin.query().public(async ({ ctx }) => {
	const rows = await ctx.db
		.query('meetings')
		.withIndex('by_createdByUserId', (q) => q.eq('createdByUserId', ctx.user.subject))
		.order('desc')
		.take(100);

	return rows.map((row) =>
		Object.assign(row, {
			status: deriveMeetingStatus(row),
			timezone: effectiveMeetingTimezone(row),
		}),
	);
});

// --- Public mutations ---

export const create = platformAdmin
	.mutation()
	.input({
		title: z.string().trim().min(1),
		date: z.number(),
		timezone: z.string().trim().min(1),
		location: z.string().optional(),
		description: z.string().optional(),
	})
	.public(async ({ ctx, args }) => {
		const code = await nextMeetingCode(ctx.db);
		const location = normalizeOptionalText(args.location);
		const description = normalizeOptionalText(args.description);

		const meetingId = await ctx.db.insert('meetings', {
			code,
			title: args.title,
			createdByUserId: ctx.user.subject,
			status: MeetingStatusSchema.enum.draft,
			timezone: args.timezone.trim(),
			...(location ? { location } : {}),
			...(description ? { description } : {}),
			date: args.date,
			startedAt: null,
			agenda: [],
			currentAgendaItemId: null,
			currentPollId: null,
			isOpen: false,
			lastConsumedCt: 0,
			currentSpeaker: null,
			previousSpeaker: null,
			break: null,
			pointOfOrder: null,
			reply: null,
		});

		const creatorParticipantId = await insertMeetingParticipant(ctx, {
			meetingId,
			userId: ctx.user.subject,
			name: ctx.user.name,
			role: 'admin',
			absentSince: 0,
		});

		await applyNewParticipantSideEffects(ctx, {
			meetingId,
			participantId: creatorParticipantId,
			name: ctx.user.name,
			isMeetingOpen: false,
		});

		return { meetingId, code };
	});

export const archive = platformAdmin
	.mutation()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);
		AppError.assertNotNull(meeting, appErrors.meeting_not_found({ meetingId: args.meetingId }));
		assertMeetingOwner(meeting.createdByUserId, ctx.user.subject);
		AppError.assert(
			!meeting.isOpen,
			appErrors.bad_request({ reason: 'meeting_must_be_closed_before_archive' }),
		);

		if (deriveMeetingStatus(meeting) === 'archived') {
			return true;
		}

		await ctx.db.patch('meetings', meeting._id, { status: MeetingStatusSchema.enum.archived });
		return true;
	});

export const reopen = platformAdmin
	.mutation()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		const meeting = await ctx.db.get('meetings', args.meetingId);
		AppError.assertNotNull(meeting, appErrors.meeting_not_found({ meetingId: args.meetingId }));
		assertMeetingOwner(meeting.createdByUserId, ctx.user.subject);

		if (deriveMeetingStatus(meeting) !== 'archived') {
			return false;
		}

		await ctx.db.patch('meetings', meeting._id, {
			status: MeetingStatusSchema.enum.closed,
			isOpen: false,
			currentPollId: null,
		});
		return true;
	});
