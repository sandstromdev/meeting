import type { Id } from '$convex/_generated/dataModel';
import { admin } from '$convex/helpers/auth';
import {
	createAgendaItemId,
	findAgendaItemById,
	flattenAgenda,
	setPollIdsForItem,
	type Agenda,
	type AgendaItemId,
	type AgendaItem,
} from '$convex/helpers/agenda';
import { AppError, errors } from '$convex/helpers/error';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { internal } from '$convex/_generated/api';

function updateAgendaItemById(
	agenda: Agenda,
	id: AgendaItemId,
	updater: (item: AgendaItem) => AgendaItem,
) {
	const found = findAgendaItemById(agenda, id);

	if (!found) {
		return agenda;
	}

	const parent = found.parent;

	if (parent === null) {
		return agenda.map((a) => (a.id === id ? updater(a) : a));
	}

	return agenda.map((a) => mapItem(a, parent.id, id, updater));
}

function mapItem(
	item: AgendaItem,
	parentId: string,
	targetId: string,
	updater: (item: AgendaItem) => AgendaItem,
): AgendaItem {
	if (item.id === targetId) {
		return updater(item);
	}
	if (item.id === parentId) {
		return {
			...item,
			items: item.items.map((child) => (child.id === targetId ? updater(child) : child)),
		};
	}
	return {
		...item,
		items: item.items.map((child) => mapItem(child, parentId, targetId, updater)),
	};
}

function appendSubItem(agenda: Agenda, parentId: string, newChild: AgendaItem) {
	return agenda.map((a) => appendToItem(a, parentId, newChild));
}

function appendToItem(item: AgendaItem, parentId: string, newChild: AgendaItem) {
	if (item.id === parentId) {
		return { ...item, items: [...item.items, newChild] };
	}
	return {
		...item,
		items: item.items.map((child) => appendToItem(child, parentId, newChild)),
	};
}

function removeAgendaItemById(agenda: Agenda, id: AgendaItemId) {
	const found = findAgendaItemById(agenda, id);
	if (!found) {
		return agenda;
	}

	const parent = found.parent;

	if (parent === null) {
		return agenda.filter((a) => a.id !== id);
	}

	return agenda.map((a) => removeFromItem(a, parent.id, id));
}

function removeFromItem(
	item: AgendaItem,
	parentId: AgendaItemId,
	targetId: AgendaItemId,
): AgendaItem {
	if (item.id === parentId) {
		return {
			...item,
			items: item.items.filter((child) => child.id !== targetId),
		};
	}
	return {
		...item,
		items: item.items.map((child) => removeFromItem(child, parentId, targetId)),
	};
}

function moveAgendaItemAmongSiblings(agenda: Agenda, id: AgendaItemId, direction: 1 | -1) {
	const found = findAgendaItemById(agenda, id);
	if (!found) {
		return { agenda, moved: false };
	}

	const siblingIndex = found.indexInParent + direction;
	const siblings = found.parent === null ? agenda : found.parent.items;
	if (siblingIndex < 0 || siblingIndex >= siblings.length) {
		return { agenda, moved: false };
	}

	const swappedSiblings = [...siblings];
	[swappedSiblings[found.indexInParent], swappedSiblings[siblingIndex]] = [
		swappedSiblings[siblingIndex],
		swappedSiblings[found.indexInParent],
	];

	if (found.parent === null) {
		return { agenda: swappedSiblings, moved: true };
	}

	return {
		agenda: updateAgendaItemById(agenda, found.parent.id, (item) => ({
			...item,
			items: swappedSiblings,
		})),
		moved: true,
	};
}

function getCurrentAgendaItemIndex(ctx: {
	meeting: { agenda: Agenda; currentAgendaItemId?: string };
}) {
	return Math.max(
		0,
		ctx.meeting.agenda.findIndex((item) => item.id === ctx.meeting.currentAgendaItemId),
	);
}

function collectPollIdsFromItem(item: AgendaItem) {
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
		const agenda = ctx.meeting.agenda;

		if (args.parentId) {
			const parentFound = findAgendaItemById(agenda, args.parentId);
			if (!parentFound) {
				throw new AppError(errors.agenda_item_not_found(args.parentId));
			}
			const newChild: AgendaItem = {
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

		const newItem: AgendaItem = {
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
		const agenda = ctx.meeting.agenda;
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
		return foundAfter?.item;
	});

export const setAgendaItemPollIds = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		pollIds: z.array(zid('polls')),
	})
	.public(async ({ ctx, args }) => {
		if (!findAgendaItemById(ctx.meeting.agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const nextAgenda = setPollIdsForItem(ctx.meeting.agenda, args.agendaItemId, args.pollIds);
		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
		return true;
	});

export const removeAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
	})
	.public(async ({ ctx, args }) => {
		const found = findAgendaItemById(ctx.meeting.agenda, args.agendaItemId);
		if (!found) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const affectedPolls = collectPollIdsFromItem(found.item);
		await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollAgendaItemIds, {
			pollIds: affectedPolls,
		});

		const nextAgenda = removeAgendaItemById(ctx.meeting.agenda, args.agendaItemId);

		const flat = flattenAgenda(nextAgenda);
		const oldFlat = flattenAgenda(ctx.meeting.agenda);
		const removedIndex = oldFlat.findIndex((item) => item.id === args.agendaItemId);
		const currentId = ctx.meeting.currentAgendaItemId;
		const currentStillExists = flat.some((item) => item.id === currentId);
		const newCurrentId =
			currentId === args.agendaItemId
				? ((removedIndex < flat.length ? flat[removedIndex]?.id : flat[0]?.id) ?? undefined)
				: (currentStillExists
					? currentId
					: flat[0]?.id);

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
		if (!findAgendaItemById(ctx.meeting.agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}
		const dir = args.direction === 'up' ? (-1 as const) : (1 as const);
		const { agenda: nextAgenda, moved } = moveAgendaItemAmongSiblings(
			ctx.meeting.agenda,
			args.agendaItemId,
			dir,
		);
		if (!moved) {
			return false;
		}
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

		if (!findAgendaItemById(ctx.meeting.agenda, args.agendaItemId)) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		await ctx.db.patch('meetings', ctx.meeting._id, {
			currentAgendaItemId: args.agendaItemId,
		});
		return true;
	});

export const next = admin.mutation().public(async ({ ctx }) => {
	const flat = flattenAgenda(ctx.meeting.agenda);
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
	const flat = flattenAgenda(ctx.meeting.agenda);
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
