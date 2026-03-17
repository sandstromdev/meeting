import { internal } from '$convex/_generated/api';
import { c } from '$convex/helpers';
import { findAgendaItemById, setPollIdsForItem } from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import { getVotersCounter, getVotesCounter } from '$convex/helpers/counters';
import { AppError, errors } from '$convex/helpers/error';
import { assertPollEditable, assertPollInMeeting, getPollOrThrow } from '$convex/helpers/poll';
import { FullPollSchema, PollBaseSchema, PollDraftSchema, PollTypeSchema } from '$lib/validation';
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

		const validated = PollBaseSchema.omit({ _id: true, _creationTime: true })
			.and(PollTypeSchema)
			.safeParse(draft);

		if (!validated.success) {
			console.log(z.prettifyError(validated.error));
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
		const optionsCount = nextAllowsAbstain ? rawOptions.length : rawOptions.length - 1;

		if (optionsCount < 1 || (optionsCount < 2 && !nextAllowsAbstain)) {
			throw new AppError(
				errors.invalid_poll_vote_limit({
					maxVotesPerVoter: 1,
					optionsCount,
				}),
			);
		}

		let updatedFields = {
			...poll,
			...args.edits,
		};

		updatedFields.updatedAt = Date.now();

		const validated = FullPollSchema.safeParse(Object.assign({}, poll, updatedFields));

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
		const now = Date.now();
		let didChange = false;

		if (ctx.meeting.currentPollId && ctx.meeting.currentPollId !== args.pollId) {
			const currentPoll = await ctx.db.get('polls', ctx.meeting.currentPollId);
			if (currentPoll && currentPoll.meetingId === ctx.meeting._id && currentPoll.isOpen) {
				await ctx.db.patch('polls', currentPoll._id, {
					isOpen: false,
					closedAt: now,
					updatedAt: now,
				});
				didChange = true;
			}
		}

		if (!poll.isOpen) {
			await ctx.db.patch('polls', args.pollId, {
				isOpen: true,
				openedAt: now,
				closedAt: undefined,
				updatedAt: now,
			});
			didChange = true;
		}

		if (ctx.meeting.currentPollId !== args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: args.pollId,
			});
			didChange = true;
		}

		return didChange;
	});

export const showPollResults = admin
	.mutation()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);

		if (poll.closedAt == null) {
			return false;
		}

		await ctx.db.patch('meetings', ctx.meeting._id, {
			currentPollId: args.pollId,
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
		let didChange = false;
		const now = Date.now();

		if (poll.isOpen) {
			await ctx.db.patch('polls', args.pollId, {
				isOpen: false,
				closedAt: now,
				updatedAt: now,
			});
			didChange = true;
		}

		if (ctx.meeting.currentPollId === args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: undefined,
			});
			didChange = true;
		}

		return didChange;
	});

export const closePollAndShowResults = admin
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

export const clearCurrentPollId = admin.mutation().public(async ({ ctx }) => {
	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentPollId: undefined,
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

		if (ctx.meeting.currentPollId === args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: undefined,
			});
		}

		await ctx.db.delete('polls', args.pollId);

		await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollVotes, {
			meetingId: ctx.meeting._id,
			pollIds: [args.pollId],
		});
	});

export const cleanupPollVotes = c
	.mutation()
	.input({
		meetingId: zid('meetings'),
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

			await Promise.all([
				getVotesCounter(args.meetingId, pollId).reset(ctx),
				getVotersCounter(args.meetingId, pollId).reset(ctx),
			]);

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

export const getAllPolls = admin.query().public(async ({ ctx }) => {
	return ctx.db
		.query('polls')
		.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
		.collect();
});

export const getPoll = admin
	.query()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		return getPollOrThrow(ctx.db, args.pollId);
	});

export const getPollsByAgendaItemId = admin
	.query()
	.input({
		agendaItemId: z.string(),
	})
	.public(async ({ ctx, args }) => {
		return ctx.db
			.query('polls')
			.withIndex('by_meeting_agendaItem', (q) =>
				q.eq('meetingId', ctx.meeting._id).eq('agendaItemId', args.agendaItemId),
			)
			.collect();
	});

export const duplicatePoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);

		const newPoll = {
			...poll,
			_id: undefined,
			_creationTime: undefined,
			isOpen: false,
			openedAt: undefined,
			closedAt: undefined,
			updatedAt: Date.now(),
		};

		const newPollId = await ctx.db.insert('polls', newPoll);

		if (poll.agendaItemId) {
			const agenda = ctx.meeting.agenda;
			const found = findAgendaItemById(agenda, poll.agendaItemId);
			if (found) {
				const nextAgenda = setPollIdsForItem(agenda, poll.agendaItemId, [
					...found.item.pollIds,
					newPollId,
				]);
				await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
			}
		}

		return newPollId;
	});

export const cancelPoll = admin
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
			closedAt: undefined,
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollVotes, {
			meetingId: ctx.meeting._id,
			pollIds: [args.pollId],
		});

		if (ctx.meeting.currentPollId === args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: undefined,
			});
		}

		return true;
	});
