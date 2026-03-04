import { admin } from '$convex/helpers/auth';
import { findAgendaItemById, normalizeAgendaItems, setPollIdsForItem } from '$convex/helpers/agenda';
import { AppError, errors } from '$convex/helpers/error';
import {
	assertPollEditable,
	assertPollInMeeting,
	assertPollTypeConfig,
	assertPollVoteLimit,
	closePoll,
	getPollMaxVotesPerVoter,
	getPollOrThrow,
	getPollType,
	optionsWithAbstainIfRequested,
	type MajorityRule,
	type PollType,
} from '$convex/helpers/poll';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

const pollTypeSchema = z.enum(['multi_winner', 'single_winner']);
const majorityRuleSchema = z.enum(['simple', 'two_thirds', 'three_quarters', 'unanimous']);

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().min(1),
		title: z.string().trim().min(1),
		options: z.array(z.string().trim().min(1)).min(1),
		type: pollTypeSchema.optional(),
		winningCount: z.number().int().positive().optional(),
		majorityRule: majorityRuleSchema.optional(),
		allowsAbstain: z.boolean().optional(),
		maxVotesPerVoter: z.number().int().positive().optional(),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const agenda = normalizeAgendaItems(ctx.meeting.agenda);
		const found = findAgendaItemById(agenda, args.agendaItemId);
		if (!found) {
			throw new AppError(errors.agenda_item_not_found(args.agendaItemId));
		}

		const item = found.item;
		const allowsAbstain = args.allowsAbstain ?? true;
		const options = optionsWithAbstainIfRequested(args.options, allowsAbstain);
		if (options.length < 2) {
			throw new AppError(
				errors.invalid_poll_vote_limit({ maxVotesPerVoter: 1, optionsCount: options.length }),
			);
		}
		const pollType: PollType = args.type ?? 'single_winner';
		assertPollTypeConfig(pollType, options.length, {
			winningCount: args.winningCount,
			majorityRule: args.majorityRule,
		});
		const maxVotesPerVoter =
			pollType === 'single_winner' ? 1 : Math.min(args.maxVotesPerVoter ?? 1, options.length);
		assertPollVoteLimit(options, maxVotesPerVoter);

		const now = Date.now();
		const pollId = await ctx.db.insert('polls', {
			meetingId: ctx.meeting._id,
			agendaItemId: args.agendaItemId,
			title: args.title,
			options,
			maxVotesPerVoter,
			type: pollType,
			winningCount: pollType === 'multi_winner' ? (args.winningCount ?? 1) : undefined,
			majorityRule: pollType === 'single_winner' ? (args.majorityRule as MajorityRule) : undefined,
			allowsAbstain,
			isOpen: false,
			resultsPublic: args.resultsPublic ?? false,
			createdBy: ctx.me._id,
			updatedAt: now,
		});

		const nextAgenda = setPollIdsForItem(agenda, args.agendaItemId, [...item.pollIds, pollId]);

		await ctx.db.patch('meetings', ctx.meeting._id, {
			agenda: nextAgenda,
		});

		return pollId;
	});

export const editPoll = admin
	.mutation()
	.input({
		pollId: zid('polls'),
		title: z.string().trim().min(1).optional(),
		options: z.array(z.string().trim().min(1)).min(1).optional(),
		type: pollTypeSchema.optional(),
		winningCount: z.number().int().positive().optional(),
		majorityRule: majorityRuleSchema.optional(),
		allowsAbstain: z.boolean().optional(),
		maxVotesPerVoter: z.number().int().positive().optional(),
		resultsPublic: z.boolean().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);
		assertPollInMeeting(poll, ctx.meeting._id);
		assertPollEditable(poll);
		const nextAllowsAbstain = args.allowsAbstain ?? poll.allowsAbstain;
		const rawOptions = args.options ?? poll.options;
		const nextOptions = optionsWithAbstainIfRequested(rawOptions, nextAllowsAbstain);
		if (nextOptions.length < 2) {
			throw new AppError(
				errors.invalid_poll_vote_limit({
					maxVotesPerVoter: 1,
					optionsCount: nextOptions.length,
				}),
			);
		}
		const nextType: PollType = args.type ?? getPollType(poll);
		assertPollTypeConfig(nextType, nextOptions.length, {
			winningCount: args.winningCount ?? poll.winningCount,
			majorityRule: (args.majorityRule as MajorityRule | undefined) ?? poll.majorityRule,
		});
		const nextMaxVotesPerVoter =
			nextType === 'single_winner'
				? 1
				: (args.maxVotesPerVoter ?? getPollMaxVotesPerVoter(poll));
		assertPollVoteLimit(nextOptions, nextMaxVotesPerVoter);

		await ctx.db.patch('polls', args.pollId, {
			title: args.title ?? poll.title,
			options: nextOptions,
			type: nextType,
			winningCount: nextType === 'multi_winner' ? (args.winningCount ?? poll.winningCount ?? 1) : undefined,
			majorityRule: nextType === 'single_winner' ? (args.majorityRule ?? poll.majorityRule) : undefined,
			allowsAbstain: nextAllowsAbstain,
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
		const found = findAgendaItemById(agenda, poll.agendaItemId);
		if (!found) {
			throw new AppError(errors.agenda_item_not_found(poll.agendaItemId));
		}

		const pollIds = found.item.pollIds.filter((id) => id !== args.pollId);
		const nextAgenda = setPollIdsForItem(agenda, poll.agendaItemId, pollIds);

		const votes = await ctx.db
			.query('pollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', args.pollId))
			.collect();
		await Promise.all(votes.map((vote) => ctx.db.delete('pollVotes', vote._id)));
		await ctx.db.delete('polls', args.pollId);

		await ctx.db.patch('meetings', ctx.meeting._id, { agenda: nextAgenda });
		return true;
	});
