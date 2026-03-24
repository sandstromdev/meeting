import { internal } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import { c } from '$convex/helpers';
import { findAgendaItemById, setPollIdsForItem } from '$convex/helpers/agenda';
import { admin } from '$convex/helpers/auth';
import {
	getAbsentCounter,
	getParticipantCounter,
	getVotersCounter,
	getVotesCounter,
} from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertPollEditable,
	assertPollInMeeting,
	buildPollResultSnapshot,
	createPollHelper,
	getLatestPollResultSnapshot,
	getPollOrThrow,
	optionsWithAbstainLast,
	stripAbstain,
	type OptionTotal,
} from '$convex/helpers/poll';
import { ABSTAIN_OPTION_LABEL, minimumVotesForMajority } from '$lib/polls';
import { FullPollSchema, PollDraftSchema, RefinePollDraftSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().nullable(),
		draft: RefinePollDraftSchema,
	})
	.public(async ({ ctx, args }) => {
		return await createPollHelper(ctx, {
			...args,
			updateAgenda: true,
		});
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
		/** Draft-shaped options (no stored `Avstår` row) for `PollDraftSchema` / refine. */
		const draftOptions = rawOptions.filter((o) => o !== ABSTAIN_OPTION_LABEL);
		const mergedType = args.edits.type ?? poll.type;

		const draftForRefine =
			mergedType === 'multi_winner'
				? {
						title: args.edits.title ?? poll.title,
						options: draftOptions,
						type: 'multi_winner' as const,
						winningCount:
							args.edits.winningCount ??
							(poll.type === 'multi_winner' ? poll.winningCount : undefined),
						isResultPublic: args.edits.isResultPublic ?? poll.isResultPublic,
						allowsAbstain: nextAllowsAbstain,
						maxVotesPerVoter: args.edits.maxVotesPerVoter ?? poll.maxVotesPerVoter,
					}
				: {
						title: args.edits.title ?? poll.title,
						options: draftOptions,
						type: 'single_winner' as const,
						winningCount: args.edits.winningCount ?? 1,
						majorityRule:
							args.edits.majorityRule ??
							(poll.type === 'single_winner' ? poll.majorityRule : undefined),
						isResultPublic: args.edits.isResultPublic ?? poll.isResultPublic,
						allowsAbstain: nextAllowsAbstain,
						maxVotesPerVoter: args.edits.maxVotesPerVoter ?? poll.maxVotesPerVoter,
					};

		const refinedDraft = RefinePollDraftSchema.safeParse(draftForRefine);
		AppError.assertZodSuccess(refinedDraft, appErrors.invalid_poll_draft);

		const options = optionsWithAbstainLast(rawOptions, nextAllowsAbstain);

		let updatedFields = {
			...poll,
			...args.edits,
			options,
		};

		updatedFields.updatedAt = Date.now();

		const validated = FullPollSchema.safeParse(Object.assign({}, poll, updatedFields));

		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

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
				await ctx.scheduler.runAfter(0, internal.admin.poll.createPollResultSnapshotAction, {
					pollId: currentPoll._id,
				});
				didChange = true;
			}
		}

		if (!poll.isOpen) {
			await ctx.db.patch('polls', args.pollId, {
				isOpen: true,
				openedAt: now,
				closedAt: null,
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
			await ctx.scheduler.runAfter(0, internal.admin.poll.createPollResultSnapshotAction, {
				pollId: args.pollId,
			});
			didChange = true;
		}

		if (ctx.meeting.currentPollId === args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: null,
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

		const now = Date.now();
		await ctx.db.patch('polls', args.pollId, {
			isOpen: false,
			closedAt: now,
			updatedAt: now,
		});

		await ctx.scheduler.runAfter(0, internal.admin.poll.createPollResultSnapshotAction, {
			pollId: args.pollId,
		});

		return true;
	});

export const clearCurrentPollId = admin.mutation().public(async ({ ctx }) => {
	await ctx.db.patch('meetings', ctx.meeting._id, {
		currentPollId: null,
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
				currentPollId: null,
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
				await ctx.db.patch('polls', pollId, { agendaItemId: null });
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
		const [participants, absentees, polls] = await Promise.all([
			getParticipantCounter(ctx.meeting._id).count(ctx),
			getAbsentCounter(ctx.meeting._id).count(ctx),
			ctx.db
				.query('polls')
				.withIndex('by_meeting_agendaItem', (q) =>
					q.eq('meetingId', ctx.meeting._id).eq('agendaItemId', args.agendaItemId),
				)
				.collect(),
		]);

		const eligibleVoters = Math.max(0, participants - absentees);

		return Promise.all(
			polls.map(async (poll) => {
				const [votesCount, votersCount] = await Promise.all([
					getVotesCounter(ctx.meeting._id, poll._id).count(ctx),
					getVotersCounter(ctx.meeting._id, poll._id).count(ctx),
				]);

				const latestResult = poll.closedAt
					? await getLatestPollResultSnapshot(ctx.db, poll._id)
					: null;

				if (poll.isOpen || poll.closedAt == null) {
					return Object.assign({}, poll, {
						votesCount,
						votersCount,
						eligibleVoters,
						complete: undefined,
						results: undefined,
						winnerOptionIndexes: undefined,
						isTie: undefined,
						winners: undefined,
						optionTotals: undefined,
					});
				}

				return Object.assign({}, poll, {
					votesCount,
					votersCount,
					eligibleVoters,
					complete: latestResult?.complete,
					results: latestResult?.results,
					winnerOptionIndexes: latestResult?.results.winners.map((winner) => winner.optionIndex),
					isTie: latestResult?.results.isTie,
					winners: latestResult?.results.winners,
					optionTotals: latestResult?.results.optionTotals,
				});
			}),
		);
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
			openedAt: null,
			closedAt: null,
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
			closedAt: null,
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.admin.poll.cleanupPollVotes, {
			meetingId: ctx.meeting._id,
			pollIds: [args.pollId],
		});

		if (ctx.meeting.currentPollId === args.pollId) {
			await ctx.db.patch('meetings', ctx.meeting._id, {
				currentPollId: null,
			});
		}

		return true;
	});

export const insertPollResultSnapshot = c
	.mutation()
	.input({
		poll: FullPollSchema,
		complete: z.boolean(),
		results: z.object({
			optionTotals: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			winners: z.array(
				z.object({
					optionIndex: z.number(),
					option: z.string(),
					votes: z.number(),
				}),
			),
			isTie: z.boolean(),
			majorityRule: z.enum(['simple', 'two_thirds', 'three_quarters', 'unanimous']).nullable(),
			counts: z.object({
				totalVotes: z.number(),
				eligibleVoters: z.number(),
				usableVotes: z.number(),
				abstain: z.number(),
			}),
		}),
	})
	.internal(async ({ ctx, args }) => {
		if (args.poll.closedAt == null) {
			return false;
		}

		const latestSnapshot = await getLatestPollResultSnapshot(ctx.db, args.poll._id);

		if (latestSnapshot?.closedAt === args.poll.closedAt) {
			return false;
		}

		await ctx.db.insert('pollResults', buildPollResultSnapshot(args));

		return true;
	});

export const createPollResultSnapshotAction = c
	.action()
	.input({ pollId: zid('polls') })
	.internal(async ({ ctx, args }): Promise<boolean> => {
		const results = await ctx.runQuery(internal.admin.poll.getPollResults, { pollId: args.pollId });

		if (results.poll.isOpen || results.poll.closedAt == null) {
			return false;
		}

		return ctx.runMutation(internal.admin.poll.insertPollResultSnapshot, results);
	});

export const getPollResults = c
	.query()
	.input({ pollId: zid('polls') })
	.internal(async ({ ctx, args }) => {
		const poll = await getPollOrThrow(ctx.db, args.pollId);

		const [participants, absentees, votes] = await Promise.all([
			getParticipantCounter(poll.meetingId).count(ctx),
			getAbsentCounter(poll.meetingId).count(ctx),
			ctx.db
				.query('pollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
				.collect(),
		]);

		let complete = true;

		const eligibleVoters = Math.max(0, participants - absentees);

		const optionTotals = poll.options.map((option, optionIndex) => ({
			optionIndex,
			option,
			votes: 0,
		}));

		const uniqueVoters = new Set<Id<'meetingParticipants'>>();

		for (const vote of votes) {
			uniqueVoters.add(vote.userId);
			if (vote.optionIndex >= 0 && vote.optionIndex < optionTotals.length) {
				optionTotals[vote.optionIndex].votes += 1;
			}
		}

		optionTotals.sort((a, b) => b.votes - a.votes);

		if (eligibleVoters !== uniqueVoters.size) {
			console.warn(
				`Eligible voter count ${eligibleVoters} does not match unique voter count ${uniqueVoters.size}`,
			);
			complete = false;
		}

		const options = stripAbstain(optionTotals, poll.allowsAbstain).toSorted(
			(a, b) => b.votes - a.votes,
		);
		const usableVotes = options.reduce((acc, o) => acc + o.votes, 0);

		let winners: OptionTotal[];
		let isTie: boolean;
		let majorityRule = null;

		if (poll.type === 'multi_winner') {
			const wc = Math.max(1, Math.min(poll.winningCount, options.length));
			const thresholdVotes = options[wc - 1]?.votes ?? 0;
			winners = options.filter((o) => o.votes >= thresholdVotes);
			const lastWinnerVotes = winners[wc - 1]?.votes;
			isTie =
				lastWinnerVotes != null && options.filter((o) => o.votes === lastWinnerVotes).length > 1;
		} else {
			const minVotes = minimumVotesForMajority(poll.majorityRule, usableVotes);
			const topVotes = options[0]?.votes;
			winners = options.filter((o) => o.votes >= minVotes && o.votes === topVotes);
			isTie = winners.length > 1;
			majorityRule = poll.majorityRule;
		}

		const votesWithoutAbstain = options.reduce((acc, o) => acc + o.votes, 0);

		return {
			poll,

			complete,

			results: {
				optionTotals,
				winners,
				isTie,
				majorityRule,

				counts: {
					totalVotes: votes.length,
					eligibleVoters,
					usableVotes,
					abstain: votes.length - votesWithoutAbstain,
				},
			},
		};
	});

export const getAllResults = admin
	.query()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		return ctx.db
			.query('pollResults')
			.withIndex('by_meeting_and_poll_and_closedAt', (q) => q.eq('meetingId', args.meetingId))
			.collect();
	});
