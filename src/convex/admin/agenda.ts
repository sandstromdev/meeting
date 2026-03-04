import type { Id } from '$convex/_generated/dataModel';
import { admin } from '$convex/helpers/auth';
import {
	appendSubItem,
	createAgendaItemId,
	findAgendaItemById,
	flattenAgenda,
	getCurrentAgendaItemIndex,
	moveAgendaItemAmongSiblings,
	normalizeAgendaItems,
	removeAgendaItemById,
	setPollIdsForItem,
	updateAgendaItemById,
	type NormalizedAgendaItem,
} from '$convex/helpers/agenda';
import { AppError, errors } from '$convex/helpers/error';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

function collectPollIdsFromItem(item: NormalizedAgendaItem): Id<'polls'>[] {
	const ids = [...item.pollIds];
	for (const child of item.items) {
		ids.push(...collectPollIdsFromItem(child));
	}
	return ids;
}

export const createAgendaItem = admin
	.mutation()
	.input({
		title: z.string().trim().min(1),
		parentId: z.string().min(1).optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);

		if (args.parentId) {
			const parentFound = findAgendaItemById(agenda, args.parentId);
			if (!parentFound) {
				throw new AppError(errors.agenda_item_not_found(args.parentId));
			}
			const newChild: NormalizedAgendaItem = {
				id: createAgendaItemId(),
				title: args.title,
				pollIds: [],
				items: [],
			};
			const nextAgenda = appendSubItem(agenda, args.parentId, newChild);
			await ctx.db.patch('meetings', ctx.meeting._id, {
				agenda: nextAgenda,
				currentAgendaItemId: ctx.meeting.currentAgendaItemId ?? newChild.id,
			});
			return newChild;
		}

		const newItem: NormalizedAgendaItem = {
			id: createAgendaItemId(),
			title: args.title,
			pollIds: [],
			items: [],
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
		const found = findAgendaItemById(agenda, args.agendaItemId);
		if (!found) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const updated = updateAgendaItemById(agenda, args.agendaItemId, (item) => ({
			...item,
			title: args.title ?? item.title,
		}));
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: updated });
		const foundAfter = findAgendaItemById(updated, args.agendaItemId);
		return foundAfter!.item;
	});

export const setAgendaItemPollIds = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		pollIds: z.array(zid('polls')),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		if (!findAgendaItemById(agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const nextAgenda = setPollIdsForItem(agenda, args.agendaItemId, args.pollIds);
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
		return true;
	});

export const removeAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const found = findAgendaItemById(agenda, args.agendaItemId);
		if (!found) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const pollIdsToDelete = collectPollIdsFromItem(found.item);
		const nextAgenda = removeAgendaItemById(agenda, args.agendaItemId);

		for (const pollId of pollIdsToDelete) {
			const votes = await ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('pollVotes', vote._id)));
			await ctx.db.delete('polls', pollId);
		}

		const flat = flattenAgenda(nextAgenda);
		const oldFlat = flattenAgenda(agenda);
		const removedIndex = oldFlat.findIndex((item) => item.id === args.agendaItemId);
		const currentId = ctx.meeting.currentAgendaItemId;
		const currentStillExists = flat.some((item) => item.id === currentId);
		const newCurrentId =
			currentId === args.agendaItemId
				? (removedIndex < flat.length ? flat[removedIndex]?.id : flat[0]?.id) ?? undefined
				: currentStillExists
					? currentId
					: flat[0]?.id;

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
			currentAgendaItemId: newCurrentId,
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
		if (!findAgendaItemById(agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const dir = args.direction === 'up' ? (-1 as const) : (1 as const);
		const { agenda: nextAgenda, moved } = moveAgendaItemAmongSiblings(agenda, args.agendaItemId, dir);
		if (!moved) return false;
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
		if (!findAgendaItemById(agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		await ctx.db.patch('meetings', ctx.meeting._id, {
			currentAgendaItemId: args.agendaItemId,
		});
		return true;
	});

export const next = admin.mutation().public(async ({ ctx }) => {
	const agenda = normalizeAgendaItems(ctx.meeting.agenda);
	const flat = flattenAgenda(agenda);
	const currentIndex = getCurrentAgendaItemIndex(ctx);
	const nextItem = flat[currentIndex + 1];

	if (!nextItem) {
		return false;
	}

	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentAgendaItemId: nextItem.id,
	});

	return nextItem;
});

export const previous = admin.mutation().public(async ({ ctx }) => {
	const agenda = normalizeAgendaItems(ctx.meeting.agenda);
	const flat = flattenAgenda(agenda);
	const currentIndex = getCurrentAgendaItemIndex(ctx);
	const previousItem = flat[currentIndex - 1];

	if (!previousItem) {
		return false;
	}

	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentAgendaItemId: previousItem.id,
	});

	return previousItem;
});
