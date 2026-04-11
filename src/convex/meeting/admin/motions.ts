import {
	findAgendaItemById,
	findAgendaItemOrThrow,
	updateAgendaItemById,
} from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	createPollForApprovedMotion,
	ensureMotionParentForAmendment,
} from '$convex/helpers/meetingMotions';
import type { Doc } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

type MeetingMutationCtx = MutationCtx & { meeting: Doc<'meetings'> };

async function finalizeApprovedMotionWithPoll(
	ctx: MeetingMutationCtx,
	motion: Doc<'meetingMotions'>,
) {
	if (motion.status === 'approved' && motion.pollId) {
		return motion;
	}

	AppError.assert(
		motion.status === 'pending' || motion.status === 'approved',
		appErrors.bad_request({ reason: 'motion_cannot_approve' }),
	);

	let pollId = motion.pollId;
	if (!pollId) {
		pollId = await createPollForApprovedMotion(ctx, {
			agendaItemId: motion.agendaItemId,
			motionTitle: motion.title,
		});
	}

	const now = Date.now();
	await ctx.db.patch('meetingMotions', motion._id, {
		status: 'approved',
		decidedAt: motion.decidedAt ?? now,
		pollId,
	});

	const next = await ctx.db.get('meetingMotions', motion._id);
	AppError.assertNotNull(next, appErrors.bad_request({ reason: 'motion_missing_after_approve' }));
	return next;
}

export const listPendingMotions = admin.query().public(async ({ ctx }) => {
	const rows = await ctx.db
		.query('meetingMotions')
		.withIndex('by_meeting_status', (q) =>
			q.eq('meetingId', ctx.meeting._id).eq('status', 'pending'),
		)
		.collect();

	rows.sort((a, b) => a.createdAt - b.createdAt);

	return rows.map((m) => ({
		_id: m._id,
		title: m.title,
		text: m.text,
		amendsMotionId: m.amendsMotionId,
		proposerName: m.proposerName,
		agendaItemId: m.agendaItemId,
		createdAt: m.createdAt,
	}));
});

export const approveMotion = admin
	.mutation()
	.input({ motionId: zid('meetingMotions') })
	.public(async ({ ctx, args }) => {
		const motion = await ctx.db.get('meetingMotions', args.motionId);
		AppError.assertNotNull(motion, appErrors.bad_request({ reason: 'motion_not_found' }));
		AppError.assert(
			motion.meetingId === ctx.meeting._id,
			appErrors.bad_request({ reason: 'motion_wrong_meeting' }),
		);

		await finalizeApprovedMotionWithPoll(ctx, motion);
		return true;
	});

export const rejectMotion = admin
	.mutation()
	.input({ motionId: zid('meetingMotions') })
	.public(async ({ ctx, args }) => {
		const motion = await ctx.db.get('meetingMotions', args.motionId);
		AppError.assertNotNull(motion, appErrors.bad_request({ reason: 'motion_not_found' }));
		AppError.assert(
			motion.meetingId === ctx.meeting._id,
			appErrors.bad_request({ reason: 'motion_wrong_meeting' }),
		);
		AppError.assert(
			motion.status === 'pending',
			appErrors.bad_request({ reason: 'motion_not_pending' }),
		);

		await ctx.db.patch('meetingMotions', motion._id, {
			status: 'rejected',
			decidedAt: Date.now(),
		});

		return true;
	});

export const createMotion = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().optional(),
		text: z.string().trim().min(1),
		amendsMotionId: zid('meetingMotions').optional(),
		/** When true (default), motion is approved immediately and a vote poll is created. */
		approveImmediately: z.boolean().optional().default(true),
	})
	.public(async ({ ctx, args }) => {
		const found = findAgendaItemById(ctx.meeting.agenda, args.agendaItemId);
		AppError.assertNotNull(found, appErrors.agenda_item_not_found(args.agendaItemId));

		let amends = args.amendsMotionId;
		if (amends) {
			await ensureMotionParentForAmendment(ctx, ctx.meeting._id, args.agendaItemId, amends);
		}

		let title = (args.title ?? '').trim();
		if (!title) {
			if (amends) {
				const parent = await ctx.db.get('meetingMotions', amends);
				title = `Tillägg till ${parent?.title?.trim() || 'yrkande'}`;
			} else {
				AppError.assert(false, appErrors.bad_request({ reason: 'motion_title_required' }));
			}
		}

		const now = Date.now();
		const id = await ctx.db.insert('meetingMotions', {
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			proposerUserId: ctx.me._id,
			proposerName: ctx.me.name,
			title,
			text: args.text,
			...(amends != null ? { amendsMotionId: amends } : {}),
			status: args.approveImmediately ? 'approved' : 'pending',
			createdAt: now,
			...(args.approveImmediately ? { decidedAt: now } : {}),
		});

		let doc = await ctx.db.get('meetingMotions', id);
		AppError.assertNotNull(doc, appErrors.bad_request({ reason: 'motion_insert_failed' }));

		if (args.approveImmediately) {
			doc = await finalizeApprovedMotionWithPoll(ctx, doc);
		}

		return doc._id;
	});

export const convertAgendaDescriptionToMotion = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().min(1).optional(),
	})
	.public(async ({ ctx, args }) => {
		const agendaNow = ctx.meeting.agenda;
		const found = findAgendaItemById(agendaNow, args.agendaItemId);
		AppError.assertNotNull(found, appErrors.agenda_item_not_found(args.agendaItemId));

		const motionText = (found.item.description ?? '').trim();
		AppError.assert(
			motionText.length > 0,
			appErrors.bad_request({ reason: 'agenda_item_has_no_description' }),
		);

		const motionTitle = (args.title ?? found.item.title ?? '').trim();
		AppError.assert(
			motionTitle.length > 0,
			appErrors.bad_request({ reason: 'motion_title_required' }),
		);

		const now = Date.now();
		const motionId = await ctx.db.insert('meetingMotions', {
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			proposerUserId: ctx.me._id,
			proposerName: ctx.me.name,
			title: motionTitle,
			text: motionText,
			status: 'approved',
			createdAt: now,
			decidedAt: now,
		});

		let motion = await ctx.db.get('meetingMotions', motionId);
		AppError.assertNotNull(motion, appErrors.bad_request({ reason: 'motion_insert_failed' }));
		motion = await finalizeApprovedMotionWithPoll(ctx, motion);

		const nextAgenda = updateAgendaItemById(agendaNow, args.agendaItemId, (item) => ({
			...item,
			description: null,
		}));

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });

		return motion._id;
	});

export const listApprovedForAgendaItem = admin
	.query()
	.input({ agendaItemId: z.string().min(1) })
	.public(async ({ ctx, args }) => {
		findAgendaItemOrThrow(ctx.meeting.agenda, args.agendaItemId);

		const rows = await ctx.db
			.query('meetingMotions')
			.withIndex('by_meeting_agenda_status', (q) =>
				q
					.eq('meetingId', ctx.meeting._id)
					.eq('agendaItemId', args.agendaItemId)
					.eq('status', 'approved'),
			)
			.collect();

		rows.sort((a, b) => a.createdAt - b.createdAt);

		return rows.map((m) => ({
			_id: m._id,
			title: m.title,
			text: m.text,
			amendsMotionId: m.amendsMotionId,
			pollId: m.pollId,
			createdAt: m.createdAt,
		}));
	});
