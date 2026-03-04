import type { Id } from '$convex/_generated/dataModel';
import { admin } from '$convex/helpers/auth';
import {
	createAgendaItemId,
	findAgendaItemIndex,
	getCurrentAgendaItemIndex,
	normalizeAgendaItems,
} from '$convex/helpers/agenda';
import { AppError, errors } from '$convex/helpers/error';
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
		const nextAgenda = agenda.filter((_, index) => index !== itemIndex);

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
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
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

export const next = admin.mutation().public(async ({ ctx }) => {
	const { agenda, _id } = ctx.meeting;
	const currentIndex = getCurrentAgendaItemIndex(ctx);

	const nextItem = agenda[currentIndex + 1];

	if (!nextItem) {
		return false;
	}

	await ctx.db.patch('meetings', _id, {
		currentAgendaItemId: nextItem.id,
	});

	return nextItem;
});

export const previous = admin.mutation().public(async ({ ctx }) => {
	const { agenda, _id } = ctx.meeting;
	const currentIndex = getCurrentAgendaItemIndex(ctx);

	const previousItem = agenda[currentIndex - 1];

	if (!previousItem) {
		return false;
	}

	await ctx.db.patch('meetings', _id, {
		currentAgendaItemId: previousItem.id,
	});

	return previousItem;
});
