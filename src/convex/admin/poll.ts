import { internal } from '$convex/_generated/api';
import { c } from '$convex/helpers';
import { findAgendaItemById, setPollIdsForItem } from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollEditable,
	assertPollInMeeting,
	getPollOrThrow,
	optionsWithAbstainIfRequested,
} from '$convex/helpers/poll';
import { PollDraftSchema, PollSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().optional(),
		draft: PollDraftSchema,
	})
	.public(async ({ ctx, args }) => {
		const agenda = ctx.meeting.agenda;

		const found = args.agendaItemId ? findAgendaItemById(agenda, args.agendaItemId) : null;

		if (args.agendaItemId && !found) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const draft = {
			...args.draft,
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			isOpen: false,
			updatedAt: Date.now(),
		};

		const validated = PollSchema.safeParse(draft);

		if (!validated.success) {
			throw new AppError(errors.invalid_poll_draft(validated.error));
		}

		const pollId = await ctx.db.insert('polls', validated.data);

		if (found) {
			const nextAgenda = setPollIdsForItem(agenda, found.item.id, [...found.item.pollIds, pollId]);

			await ctx.db.patch('meetings', ctx.meeting._id, {
				agenda: nextAgenda,
			});
		}

		return pollId;
	});

export const editPoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		edits: PollDraftSchema.partial(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);

		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);

		const nextAllowsAbstain = args.edits.allowsAbstain ?? poll.allowsAbstain;
		const rawOptions = args.edits.options ?? poll.options;
		const nextOptions = optionsWithAbstainIfRequested(rawOptions, nextAllowsAbstain);

		if (nextOptions.length < 2) {
			throw new AppError(
				errors.invalid_poll_vote_limit({
					maxVotesPerVoter: 1,
					optionsCount: nextOptions.length,
				}),
			);
		}

		let updatedFields = {
			...poll,
			...args.edits,
		};

		updatedFields.updatedAt = Date.now();

		const validated = PollSchema.safeParse(Object.assign({}, poll, updatedFields));

		if (!validated.success) {
			throw new AppError(errors.invalid_poll_draft(validated.error));
		}

		await ctx.db.replace('polls', args.pollId, validated.data);

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

		await ctx.db.patch('polls', args.pollId, {
			isOpen: false,
			closedAt: Date.now(),
			updatedAt: Date.now(),
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

		const agendaItemId = poll.agendaItemId;

		if (agendaItemId) {
			const agenda = ctx.meeting.agenda;
			const found = findAgendaItemById(agenda, agendaItemId);

			if (found) {
				const pollIds = found.item.pollIds.filter((id) => id !== args.pollId);
				const nextAgenda = setPollIdsForItem(agenda, agendaItemId, pollIds);

				await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
			}
		}

		await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollVotes, {
			pollIds: [args.pollId],
		});
	});

export const cleanupPollVotes = c
	.mutation()
	.input({
		pollIds: z.array(zid('polls')),
	})
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const votes = await ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('pollVotes', vote._id)));
			deleted += votes.length;
		}
		return { deleted };
	});

export const cleanupPollAgendaItemIds = c
	.mutation()
	.input({
		pollIds: z.array(zid('polls')),
	})
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const poll = await ctx.db.get('polls', pollId);
			if (poll) {
				await ctx.db.patch('polls', pollId, { agendaItemId: undefined });
				deleted += 1;
			}
		}
		return { deleted };
	});
