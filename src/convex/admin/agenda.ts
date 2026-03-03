import type { Id } from '$convex/_generated/dataModel';
import { admin } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollEditable,
	assertPollInMeeting,
	closePoll,
	createAgendaItemId,
	findAgendaItemIndex,
	getPollOrThrow,
	normalizeAgendaItems,
} from '$convex/helpers/poll';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const createAgendaItem = admin
	.mutation()
	.input({
		title: z.string().trim().min(1),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const newItem = {
			id: createAgendaItemId(),
			number: agenda.length + 1,
			title: args.title,
			pollIds: [] as Id<'polls'>[],
		};
		const nextAgenda = [...agenda, newItem];
		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
			currentAgendaItemId: ctx.meeting.currentAgendaItemId ?? newItem.id,
		});
		return newItem;
	});

export const updateAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().min(1).optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const item = agenda[itemIndex];
		agenda[itemIndex] = {
			...item,
			title: args.title ?? item.title,
		};
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda });
		return agenda[itemIndex];
	});

export const setAgendaItemPollIds = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		pollIds: z.array(zid('polls')),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		agenda[itemIndex] = { ...agenda[itemIndex], pollIds: args.pollIds };
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda });
		return true;
	});

export const removeAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const item = agenda[itemIndex];
		const nextAgenda = agenda
			.filter((_, index) => index !== itemIndex)
			.map((agendaItem, index) => ({ ...agendaItem, number: index + 1 }));

		for (const pollId of item.pollIds) {
			const votes = await ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('pollVotes', vote._id)));
			await ctx.db.delete('polls', pollId);
		}

		const currentAgendaItemId =
			ctx.meeting.currentAgendaItemId === args.agendaItemId
				? nextAgenda[0]?.id
				: ctx.meeting.currentAgendaItemId;

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
			currentAgendaItemId,
		});
		return true;
	});

export const moveAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		direction: z.enum(['up', 'down']),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const swapIndex = args.direction === 'up' ? itemIndex - 1 : itemIndex + 1;
		if (swapIndex < 0 || swapIndex >= agenda.length) {
			return false;
		}

		const nextAgenda = [...agenda];
		[nextAgenda[itemIndex], nextAgenda[swapIndex]] = [nextAgenda[swapIndex], nextAgenda[itemIndex]];
		const reordered = nextAgenda.map((item, index) => ({ ...item, number: index + 1 }));
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: reordered });
		return true;
	});

export const setCurrentAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1).nullable(),
	})
	.public(async ({ ctx, args }) => {
		if (!args.agendaItemId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentAgendaItemId: undefined,
			});
			return true;
		}

		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const item = agenda.find((entry) => entry.id === args.agendaItemId);
		if (!item) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		await ctx.db.patch('meetings', ctx.meeting._id, {
			currentAgendaItemId: args.agendaItemId,
		});
		return true;
	});

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().min(1),
		options: z.array(z.string().trim().min(1)).min(2),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const item = agenda[itemIndex];

		const now = Date.now();
		const pollId = await ctx.db.insert('polls', {
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			title: args.title,
			options: args.options,
			isOpen: false,
			resultsPublic: args.resultsPublic ?? false,
			createdBy: ctx.me._id,
			updatedAt: now,
		});

		agenda[itemIndex] = {
			...item,
			pollIds: [...item.pollIds, pollId],
		};

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda,
		});

		return pollId;
	});

export const editPoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		title: z.string().trim().min(1).optional(),
		options: z.array(z.string().trim().min(1)).min(2).optional(),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);

		await ctx.db.patch('polls', args.pollId, {
			title: args.title ?? poll.title,
			options: args.options ?? poll.options,
			resultsPublic: args.resultsPublic ?? poll.resultsPublic,
			updatedAt: Date.now(),
		});
		return true;
	});

export const openPoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);

		if (poll.isOpen) {
			return false;
		}

		await ctx.db.patch('polls', args.pollId, {
			isOpen: true,
			openedAt: Date.now(),
			closedAt: undefined,
			closedBy: undefined,
			updatedAt: Date.now(),
		});

		return true;
	});

export const closePollByAdmin = admin
	.mutation()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);

		if (!poll.isOpen) {
			return false;
		}

		await closePoll(ctx.db, args.pollId, {
			closedBy: ctx.me._id,
		});
		return true;
	});

export const removePoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);

		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, poll.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(poll.agendaItemId));
		}

		const item = agenda[itemIndex];
		const pollIds = item.pollIds.filter((id) => id !== args.pollId);
		agenda[itemIndex] = { ...item, pollIds };

		const votes = await ctx.db
			.query('pollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', args.pollId))
			.collect();
		await Promise.all(votes.map((vote) => ctx.db.delete('pollVotes', vote._id)));
		await ctx.db.delete('polls', args.pollId);

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda });
		return true;
	});
