import { internal } from '$convex/_generated/api';
import {
	appendToAgenda,
	canMoveSubtree,
	createAgendaItemId,
	findAgendaItemById,
	findAgendaItemOrThrow,
	getNextAgendaItem,
	getPreviousAgendaItem,
	moveSubtree,
	removeItemKeepChildren,
	removeSubtree,
	setPollIdsForItem,
	updateAgendaItemById,
	type AgendaItem,
	type AgendaItemId,
} from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertMeetingPollEditable,
	assertMeetingPollInMeeting,
	createMeetingPollHelper,
	getMeetingPollOrThrow,
} from '$convex/helpers/meetingPoll';
import { optionsWithAbstainLastRows } from '$lib/pollOptions';
import { FullPollSchema, PollDraftSchema, RefinePollDraftSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import type { Id } from '$convex/_generated/dataModel';

// --- Public mutations ---

function normalizeAgendaItemDescription(raw: string | undefined): string | null | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const t = raw.trim();
	return t === '' ? null : t;
}

export const createAgendaItem = admin
	.mutation()
	.input({
		title: z.string().trim().nonempty(),
		description: z.string().optional(),
		parentId: z.string().nonempty().optional(),
		polls: z.array(RefinePollDraftSchema),
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;

		const { parentId } = args;

		const agendaItemId = createAgendaItemId();

		console.log({ args, agendaItemId });

		const pollIds = await Promise.all(
			args.polls.map(async (poll) => {
				return await createMeetingPollHelper(ctx, {
					draft: poll,
					agendaItemId,
					updateAgenda: false,
				});
			}),
		);

		const newItem = {
			id: agendaItemId,
			title: args.title,
			description:
				args.description === undefined
					? null
					: (normalizeAgendaItemDescription(args.description) ?? null),
			pollIds,
			depth: 0,
		} satisfies AgendaItem;

		if (parentId) {
			const parent = findAgendaItemOrThrow(agenda, parentId);

			newItem.depth = parent.item.depth + 1;
		}

		const nextAgenda = appendToAgenda(agenda, newItem, parentId);

		console.log({
			nextAgenda,
			newItem,
		});

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
		description: z.string().optional(),
		polls: z.array(PollDraftSchema.extend({ id: zid('meetingPolls').optional() })),
	})
	.public(async ({ ctx, args }) => {
		const agendaNow = ctx.meeting.agenda;

		const { item } = findAgendaItemOrThrow(agendaNow, args.agendaItemId);

		for (const poll of args.polls) {
			const refined = RefinePollDraftSchema.safeParse(poll);
			AppError.assertZodSuccess(refined, appErrors.invalid_poll_draft);
		}

		const oldPollIds = item.pollIds;
		const newPollIds = new Set<Id<'meetingPolls'>>();
		const seenExisting = new Set<Id<'meetingPolls'>>();

		for (const poll of args.polls) {
			if (poll.id) {
				AppError.assert(
					!seenExisting.has(poll.id),
					appErrors.bad_request({ reason: 'duplicate_poll_id_in_request', pollId: poll.id }),
				);

				seenExisting.add(poll.id);

				AppError.assert(
					oldPollIds.includes(poll.id),
					appErrors.bad_request({ reason: 'poll_not_on_agenda_item', pollId: poll.id }),
				);

				const existing = await getMeetingPollOrThrow(ctx.db, poll.id);

				assertMeetingPollInMeeting(existing, ctx.meeting._id);
				assertMeetingPollEditable(existing);

				const nextAllowsAbstain = poll.allowsAbstain;
				const options = optionsWithAbstainLastRows(poll.options, nextAllowsAbstain);

				const base = {
					...existing,
					title: poll.title,
					options,
					isResultPublic: poll.isResultPublic,
					allowsAbstain: poll.allowsAbstain,
					maxVotesPerVoter: poll.maxVotesPerVoter,
					updatedAt: Date.now(),
				};

				const merged =
					poll.type === 'multi_winner'
						? (() => {
								const winningCount = poll.winningCount;
								AppError.assert(
									winningCount != null && winningCount >= 1,
									appErrors.invalid_poll_type_config({
										kind: 'winningCount',
										value: winningCount ?? 0,
										optionsCount: poll.options.length,
									}),
								);
								return { ...base, type: 'multi_winner' as const, winningCount };
							})()
						: (() => {
								const majorityRule = poll.majorityRule;
								AppError.assert(
									majorityRule != null,
									appErrors.invalid_poll_type_config({ kind: 'majorityRule_required' }),
								);
								return { ...base, type: 'single_winner' as const, majorityRule };
							})();

				const validated = FullPollSchema.safeParse(merged);
				AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

				await ctx.db.replace('meetingPolls', poll.id, validated.data);
				newPollIds.add(poll.id);
			} else {
				const pollId = await createMeetingPollHelper(ctx, {
					draft: poll,
					agendaItemId: args.agendaItemId,
					updateAgenda: false,
				});
				newPollIds.add(pollId);
			}
		}

		const removedPollIds = oldPollIds.filter((id) => !newPollIds.has(id));
		const clearsCurrentPoll =
			!!ctx.meeting.currentPollId && removedPollIds.includes(ctx.meeting.currentPollId);

		if (removedPollIds.length > 0) {
			await ctx.scheduler.runAfter(
				0,
				internal.meeting.jobs.meetingPollCleanup.cleanupPollAgendaItemIds,
				{
					pollIds: removedPollIds,
				},
			);
		}

		const agenda = updateAgendaItemById(agendaNow, args.agendaItemId, (agendaItem) => ({
			...agendaItem,
			title: args.title ?? agendaItem.title,
			...(args.description !== undefined
				? { description: normalizeAgendaItemDescription(args.description) ?? null }
				: {}),
			pollIds: Array.from(newPollIds),
		}));

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda,
			...(clearsCurrentPoll ? { currentPollId: null } : {}),
		});

		const foundAfter = findAgendaItemById(agenda, args.agendaItemId);

		return foundAfter?.item;
	});

export const setAgendaItemPollIds = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		pollIds: z.array(zid('meetingPolls')),
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
			await ctx.scheduler.runAfter(
				0,
				internal.meeting.jobs.meetingPollCleanup.cleanupPollAgendaItemIds,
				{
					pollIds: affectedPolls,
				},
			);
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
			currentPollId: clearsCurrentPoll ? null : ctx.meeting.currentPollId,
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
				currentAgendaItemId: null,
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
