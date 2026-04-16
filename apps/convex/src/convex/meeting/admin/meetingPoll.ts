import { internal } from '@lsnd/convex/_generated/api';
import { findAgendaItemById, setPollIdsForItem } from '@lsnd/convex/helpers/agenda';
import { admin } from '@lsnd/convex/helpers/auth';
import {
	getAbsentCounter,
	getParticipantCounter,
	getVotersCounter,
	getVotesCounter,
} from '@lsnd/convex/helpers/counters';
import { AppError, appErrors } from '@lsnd/convex/helpers/error';
import {
	assertMeetingPollEditable,
	assertMeetingPollInMeeting,
	createMeetingPollHelper,
	getLatestMeetingPollResultSnapshot,
	getMeetingPollOrThrow,
} from '@lsnd/convex/helpers/meetingPoll';
import { draftOptionsFromStored, optionsWithAbstainLastRows } from '$lib/pollOptions';
import { FullPollSchema, PollDraftSchema, RefinePollDraftSchema } from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

export const getAllPolls = admin.query().public(async ({ ctx }) => {
	return ctx.db
		.query('meetingPolls')
		.withIndex('by_meeting', (q) => q.eq('meetingId', ctx.meeting._id))
		.collect();
});

export const getPoll = admin
	.query()
	.input({
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		return getMeetingPollOrThrow(ctx.db, args.pollId);
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
				.query('meetingPolls')
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
					? await getLatestMeetingPollResultSnapshot(ctx.db, poll._id)
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

export const getAllResults = admin
	.query()
	.input({ meetingId: zid('meetings') })
	.public(async ({ ctx, args }) => {
		return ctx.db
			.query('meetingPollResults')
			.withIndex('by_meeting_and_poll_and_closedAt', (q) => q.eq('meetingId', args.meetingId))
			.collect();
	});

// --- Public mutations ---

export const createPoll = admin
	.mutation()
	.input({
		agendaItemId: z.string().nullable(),
		draft: RefinePollDraftSchema,
	})
	.public(async ({ ctx, args }) => {
		return await createMeetingPollHelper(ctx, {
			...args,
			updateAgenda: true,
		});
	});

export const editPoll = admin
	.mutation()
	.input({
		pollId: zid('meetingPolls'),
		edits: PollDraftSchema.partial(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);

		assertMeetingPollInMeeting(poll, ctx.meeting._id);
		assertMeetingPollEditable(poll);

		const nextAllowsAbstain = args.edits.allowsAbstain ?? poll.allowsAbstain;
		const draftOptions =
			args.edits.options ?? draftOptionsFromStored(poll.options, poll.allowsAbstain);
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

		const options = optionsWithAbstainLastRows(refinedDraft.data.options, nextAllowsAbstain);

		let updatedFields = {
			...poll,
			...args.edits,
			options,
		};

		updatedFields.updatedAt = Date.now();

		const validated = FullPollSchema.safeParse(Object.assign({}, poll, updatedFields));

		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		await ctx.db.replace('meetingPolls', args.pollId, validated.data);

		return true;
	});

export const openPoll = admin
	.mutation()
	.input({
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);
		const now = Date.now();
		let didChange = false;

		if (ctx.meeting.currentPollId && ctx.meeting.currentPollId !== args.pollId) {
			const currentPoll = await ctx.db.get('meetingPolls', ctx.meeting.currentPollId);
			if (currentPoll && currentPoll.meetingId === ctx.meeting._id && currentPoll.isOpen) {
				await ctx.db.patch('meetingPolls', currentPoll._id, {
					isOpen: false,
					closedAt: now,
					updatedAt: now,
				});
				await ctx.scheduler.runAfter(
					0,
					internal.meeting.jobs.meetingPollClose.createPollResultSnapshotAction,
					{
						pollId: currentPoll._id,
					},
				);
				didChange = true;
			}
		}

		if (!poll.isOpen) {
			await ctx.db.patch('meetingPolls', args.pollId, {
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
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);

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
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);
		let didChange = false;
		const now = Date.now();

		if (poll.isOpen) {
			await ctx.db.patch('meetingPolls', args.pollId, {
				isOpen: false,
				closedAt: now,
				updatedAt: now,
			});
			await ctx.scheduler.runAfter(
				0,
				internal.meeting.jobs.meetingPollClose.createPollResultSnapshotAction,
				{
					pollId: args.pollId,
				},
			);
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
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);

		if (!poll.isOpen) {
			return false;
		}

		const now = Date.now();
		await ctx.db.patch('meetingPolls', args.pollId, {
			isOpen: false,
			closedAt: now,
			updatedAt: now,
		});

		await ctx.scheduler.runAfter(
			0,
			internal.meeting.jobs.meetingPollClose.createPollResultSnapshotAction,
			{
				pollId: args.pollId,
			},
		);

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
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);
		assertMeetingPollEditable(poll);

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

		await ctx.db.delete('meetingPolls', args.pollId);

		await ctx.scheduler.runAfter(0, internal.meeting.jobs.meetingPollCleanup.cleanupPollVotes, {
			meetingId: ctx.meeting._id,
			pollIds: [args.pollId],
		});
	});

export const duplicatePoll = admin
	.mutation()
	.input({
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);
		assertMeetingPollEditable(poll);

		const newPoll = {
			...poll,
			_id: undefined,
			_creationTime: undefined,
			isOpen: false,
			openedAt: null,
			closedAt: null,
			updatedAt: Date.now(),
		};

		const newPollId = await ctx.db.insert('meetingPolls', newPoll);

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
		pollId: zid('meetingPolls'),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getMeetingPollOrThrow(ctx.db, args.pollId);
		assertMeetingPollInMeeting(poll, ctx.meeting._id);

		if (!poll.isOpen) {
			return false;
		}

		await ctx.db.patch('meetingPolls', args.pollId, {
			isOpen: false,
			closedAt: null,
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.meeting.jobs.meetingPollCleanup.cleanupPollVotes, {
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
