import { admin } from '$convex/helpers/auth';
import { findAgendaItemIndex, normalizeAgendaItems } from '$convex/helpers/agenda';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollEditable,
	assertPollInMeeting,
	assertPollVoteLimit,
	closePoll,
	getPollMaxVotesPerVoter,
	getPollOrThrow,
} from '$convex/helpers/poll';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().min(1),
		options: z.array(z.string().trim().min(1)).min(2),
		maxVotesPerVoter: z.number().int().positive().optional(),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const itemIndex = findAgendaItemIndex(agenda, args.agendaItemId);
		if (itemIndex === -1) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const item = agenda[itemIndex];
		const maxVotesPerVoter = args.maxVotesPerVoter ?? 1;
		assertPollVoteLimit(args.options, maxVotesPerVoter);

		const now = Date.now();
		const pollId = await ctx.db.insert('polls', {
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			title: args.title,
			options: args.options,
			maxVotesPerVoter,
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
		maxVotesPerVoter: z.number().int().positive().optional(),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);
		const nextOptions = args.options ?? poll.options;
		const nextMaxVotesPerVoter = args.maxVotesPerVoter ?? getPollMaxVotesPerVoter(poll);
		assertPollVoteLimit(nextOptions, nextMaxVotesPerVoter);

		await ctx.db.patch('polls', args.pollId, {
			title: args.title ?? poll.title,
			options: nextOptions,
			maxVotesPerVoter: nextMaxVotesPerVoter,
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
