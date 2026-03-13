import { internal } from '$convex/_generated/api';
import {
	appendToAgenda,
	canMoveSubtree,
	createNewAgendaItem,
	findAgendaItemById,
	findAgendaItemOrThrow,
	getNextAgendaItem,
	getPreviousAgendaItem,
	moveSubtree,
	removeItemKeepChildren,
	removeSubtree,
	updateAgendaItemById,
	setPollIdsForItem,
	type AgendaItem,
	type AgendaItemId,
} from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const createAgendaItem = admin
	.mutation()
	.input({
		title: z.string().trim().nonempty(),
		parentId: z.string().nonempty().optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;

		const { parentId } = args;

		if (parentId) {
			const parent = findAgendaItemOrThrow(agenda, parentId);

			const newChild = createNewAgendaItem(args.title, parent.item.depth + 1);
			const nextAgenda = appendToAgenda(agenda, parentId, newChild);

			await ctx.db.patch('meetings', ctx.meeting._id, {
				agenda: nextAgenda,
				currentAgendaItemId: ctx.meeting.currentAgendaItemId ?? newChild.id,
			});

			return newChild;
		}

		const newItem = createNewAgendaItem(args.title, 0);

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
		const agendaNow = ctx.meeting.agenda;
		findAgendaItemOrThrow(agendaNow, args.agendaItemId);

		const agenda = updateAgendaItemById(agendaNow, args.agendaItemId, (item) => ({
			...item,
			title: args.title ?? item.title,
		}));

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda });

		const foundAfter = findAgendaItemById(agenda, args.agendaItemId);

		return foundAfter?.item;
	});

export const setAgendaItemPollIds = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		pollIds: z.array(zid('polls')),
	})
	.public(async ({ ctx, args }) => {
		const agendaNow = ctx.meeting.agenda;
		findAgendaItemOrThrow(agendaNow, args.agendaItemId);

		const agenda = setPollIdsForItem(agendaNow, args.agendaItemId, args.pollIds);

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda });

		return true;
	});

export const removeAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		deletionMode: z.enum(['delete_subtree', 'keep_children']).default('delete_subtree'),
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;
		findAgendaItemOrThrow(agenda, args.agendaItemId);

		const oldIndex = agenda.findIndex((item) => item.id === args.agendaItemId);
		const removedResult =
			args.deletionMode === 'keep_children'
				? removeItemKeepChildren(agenda, args.agendaItemId)
				: removeSubtree(agenda, args.agendaItemId);
		const nextAgenda = removedResult.agenda;

		let removedItems: AgendaItem[] = [];

		if (Array.isArray(removedResult.removed)) {
			removedItems = removedResult.removed;
		} else if (removedResult.removed) {
			removedItems = [removedResult.removed];
		}

		const affectedPolls = removedItems.flatMap((item) => item.pollIds);
		const clearsCurrentPoll =
			!!ctx.meeting.currentPollId && affectedPolls.includes(ctx.meeting.currentPollId);

		if (affectedPolls.length > 0) {
			await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollAgendaItemIds, {
				pollIds: affectedPolls,
			});
		}

		const currentId = ctx.meeting.currentAgendaItemId;

		let newCurrentId: AgendaItemId | undefined;

		const removedIds = new Set(removedItems.map((item) => item.id));
		const isCurrentRemoved = !!currentId && removedIds.has(currentId);

		if (isCurrentRemoved) {
			const fallbackIndex =
				oldIndex < 0 ? 0 : Math.min(oldIndex, Math.max(nextAgenda.length - 1, 0));
			newCurrentId = nextAgenda[fallbackIndex]?.id ?? nextAgenda[0]?.id;
		} else {
			newCurrentId = currentId ?? nextAgenda[0]?.id;
		}

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
			currentAgendaItemId: newCurrentId,
			currentPollId: clearsCurrentPoll ? undefined : ctx.meeting.currentPollId,
		});

		return true;
	});

export const moveAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		direction: z.enum(['up', 'down', 'in', 'out']),
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;
		findAgendaItemOrThrow(agenda, args.agendaItemId);

		if (!canMoveSubtree(agenda, args.agendaItemId, args.direction)) {
			return false;
		}

		const nextAgenda = moveSubtree(agenda, args.agendaItemId, args.direction);

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });

		return true;
	});

export const setCurrentAgendaItem = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1).nullable(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;
		if (!args.agendaItemId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentAgendaItemId: undefined,
			});

			return true;
		}

		findAgendaItemOrThrow(agenda, args.agendaItemId);

		await ctx.db.patch('meetings', ctx.meeting._id, {
			currentAgendaItemId: args.agendaItemId,
		});

		return true;
	});

export const next = admin.mutation().public(async ({ ctx }) => {
	const agenda = ctx.meeting.agenda;
	const nextItem = getNextAgendaItem(agenda, ctx.meeting.currentAgendaItemId);

	if (!nextItem) {
		return false;
	}

	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentAgendaItemId: nextItem.id,
	});

	return nextItem;
});

export const previous = admin.mutation().public(async ({ ctx }) => {
	const agenda = ctx.meeting.agenda;
	const previousItem = getPreviousAgendaItem(agenda, ctx.meeting.currentAgendaItemId);

	if (!previousItem) {
		return false;
	}

	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentAgendaItemId: previousItem.id,
	});

	return previousItem;
});
