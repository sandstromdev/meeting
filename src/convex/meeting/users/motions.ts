import { withMe } from '$convex/helpers/auth';
import {
	prepareParticipantMotionSubmission,
	resolveCurrentAgendaItemId,
} from '$convex/helpers/meetingMotions';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const listApprovedForCurrentAgenda = withMe.query().public(async ({ ctx }) => {
	const currentId = resolveCurrentAgendaItemId(ctx.meeting);
	if (!currentId) {
		return [];
	}

	const rows = await ctx.db
		.query('meetingMotions')
		.withIndex('by_meeting_agenda_status', (q) =>
			q.eq('meetingId', ctx.meeting._id).eq('agendaItemId', currentId).eq('status', 'approved'),
		)
		.collect();

	rows.sort((a, b) => a.createdAt - b.createdAt);

	return rows.map((m) => ({
		_id: m._id,
		title: m.title,
		text: m.text,
		amendsMotionId: m.amendsMotionId,
		proposerName: m.proposerName,
		createdAt: m.createdAt,
		pollId: m.pollId,
	}));
});

export const getMyPendingMotion = withMe.query().public(async ({ ctx }) => {
	const pending = await ctx.db
		.query('meetingMotions')
		.withIndex('by_meeting_proposer_status', (q) =>
			q.eq('meetingId', ctx.meeting._id).eq('proposerUserId', ctx.me._id).eq('status', 'pending'),
		)
		.first();

	if (!pending) {
		return null;
	}

	return {
		_id: pending._id,
		title: pending.title,
		text: pending.text,
		amendsMotionId: pending.amendsMotionId,
		agendaItemId: pending.agendaItemId,
		createdAt: pending.createdAt,
	};
});

export const submitMotion = withMe
	.mutation()
	.input({
		title: z.string().optional(),
		text: z.string(),
		amendsMotionId: zid('meetingMotions').optional(),
	})
	.public(async ({ ctx, args }) => {
		const existing = await ctx.db
			.query('meetingMotions')
			.withIndex('by_meeting_proposer_status', (q) =>
				q.eq('meetingId', ctx.meeting._id).eq('proposerUserId', ctx.me._id).eq('status', 'pending'),
			)
			.first();

		if (existing) {
			return { ok: false as const, reason: 'already_pending' as const };
		}

		const prepared = await prepareParticipantMotionSubmission(ctx, {
			meeting: ctx.meeting,
			me: ctx.me,
			title: args.title,
			text: args.text,
			amendsMotionId: args.amendsMotionId,
		});

		if (!prepared) {
			return { ok: false as const, reason: 'invalid' as const };
		}

		const now = Date.now();
		await ctx.db.insert('meetingMotions', {
			meetingId: ctx.meeting._id,
			agendaItemId: prepared.agendaItemId,
			proposerUserId: ctx.me._id,
			proposerName: ctx.me.name,
			title: prepared.title,
			text: prepared.text,
			...(prepared.amendsMotionId != null ? { amendsMotionId: prepared.amendsMotionId } : {}),
			status: 'pending',
			createdAt: now,
		});

		return { ok: true as const };
	});

export const withdrawMyPendingMotion = withMe.mutation().public(async ({ ctx }) => {
	const pending = await ctx.db
		.query('meetingMotions')
		.withIndex('by_meeting_proposer_status', (q) =>
			q.eq('meetingId', ctx.meeting._id).eq('proposerUserId', ctx.me._id).eq('status', 'pending'),
		)
		.first();

	if (!pending) {
		return false;
	}

	await ctx.db.patch('meetingMotions', pending._id, {
		status: 'withdrawn',
		decidedAt: Date.now(),
	});

	return true;
});
