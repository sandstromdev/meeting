import { internal } from '$convex/_generated/api';
import type { MutationCtx } from '$convex/_generated/server';
import { authed } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertUserPollEditable,
	assertUserPollOwner,
	getLatestUserPollResultSnapshot,
	getUserPollOrThrow,
} from '$convex/helpers/userPoll';
import { draftOptionsFromStored, optionsWithAbstainLastRows } from '$lib/pollOptions';
import {
	FullUserPollSchema,
	PollDraftSchema,
	PollTypeSchema,
	RefinePollDraftSchema,
	refinePollRowTypeConfig,
	UserPollBaseSchema,
} from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';

function createCode() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let value = '';
	for (let i = 0; i < 8; i += 1) {
		value += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return value;
}

async function createUniqueCode(ctx: MutationCtx) {
	for (let i = 0; i < 8; i += 1) {
		const code = createCode();
		const existing = await ctx.db
			.query('userPolls')
			.withIndex('by_code', (q) => q.eq('code', code))
			.unique();
		if (!existing) {
			return code;
		}
	}
	throw appErrors.internal_error();
}

const userPollAdmin = authed.use(({ ctx, next }) => {
	AppError.assert(ctx.user.role === 'admin', appErrors.forbidden());
	return next(ctx);
});

// --- Public queries ---

export const listMyPolls = userPollAdmin.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('userPolls')
		.withIndex('by_ownerUserId_and_updatedAt', (q) => q.eq('ownerUserId', ctx.user.subject))
		.order('desc')
		.collect();
});

export const getPoll = userPollAdmin
	.query()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		return poll;
	});

/** Latest stored result snapshot for dashboard / owner review (ignores `isResultPublic`). */
export const getMyPollResultsSnapshot = userPollAdmin
	.query()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);

		if (poll.isOpen) {
			return { kind: 'open' as const };
		}
		if (poll.closedAt == null) {
			return { kind: 'cancelled' as const };
		}

		const snapshot = await getLatestUserPollResultSnapshot(ctx.db, args.pollId);
		if (!snapshot) {
			return { kind: 'pending' as const };
		}

		return {
			kind: 'ready' as const,
			complete: snapshot.complete,
			results: snapshot.results,
		};
	});

// --- Public mutations ---

export const createPoll = userPollAdmin
	.mutation()
	.input({
		draft: RefinePollDraftSchema,
	})
	.public(async ({ ctx, args }) => {
		const draft = {
			...args.draft,
			code: await createUniqueCode(ctx),
			ownerUserId: ctx.user.subject,
			isOpen: false,
			updatedAt: Date.now(),
			openedAt: null,
			closedAt: null,
			options: optionsWithAbstainLastRows(args.draft.options, args.draft.allowsAbstain),
		};

		const validated = UserPollBaseSchema.omit({ _id: true, _creationTime: true })
			.and(PollTypeSchema)
			.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx))
			.safeParse(draft);

		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		return await ctx.db.insert('userPolls', validated.data);
	});

export const duplicatePoll = userPollAdmin
	.mutation()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const source = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(source, ctx.user.subject);

		const draftOptions = draftOptionsFromStored(source.options, source.allowsAbstain);
		const draft = {
			title: `${source.title} (kopia)`,
			type: source.type,
			winningCount: source.winningCount,
			majorityRule: source.majorityRule,
			maxVotesPerVoter: source.maxVotesPerVoter,
			allowsAbstain: source.allowsAbstain,
			isResultPublic: source.isResultPublic,
			code: await createUniqueCode(ctx),
			ownerUserId: ctx.user.subject,
			visibilityMode: source.visibilityMode,
			isOpen: false,
			updatedAt: Date.now(),
			openedAt: null,
			closedAt: null,
			options: optionsWithAbstainLastRows(draftOptions, source.allowsAbstain),
		};

		const validated = UserPollBaseSchema.omit({ _id: true, _creationTime: true })
			.and(PollTypeSchema)
			.superRefine((data, zCtx) => refinePollRowTypeConfig(data, zCtx))
			.safeParse(draft);
		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		return await ctx.db.insert('userPolls', validated.data);
	});

export const editPoll = userPollAdmin
	.mutation()
	.input({
		pollId: zid('userPolls'),
		edits: PollDraftSchema.partial(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		assertUserPollEditable(poll);

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
		const updatedFields = {
			...poll,
			...args.edits,
			options,
			updatedAt: Date.now(),
		};

		const validated = FullUserPollSchema.safeParse(Object.assign({}, poll, updatedFields));
		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		await ctx.db.replace('userPolls', args.pollId, validated.data);
		return true;
	});

export const openPoll = userPollAdmin
	.mutation()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		if (poll.isOpen) {
			return false;
		}

		await ctx.db.patch('userPolls', args.pollId, {
			isOpen: true,
			openedAt: Date.now(),
			closedAt: null,
			updatedAt: Date.now(),
		});
		return true;
	});

export const closePoll = userPollAdmin
	.mutation()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		if (!poll.isOpen) {
			return false;
		}

		const now = Date.now();
		await ctx.db.patch('userPolls', args.pollId, {
			isOpen: false,
			closedAt: now,
			updatedAt: now,
		});
		await ctx.scheduler.runAfter(
			0,
			internal.userPoll.jobs.snapshot.createPollResultSnapshotAction,
			{
				pollId: args.pollId,
			},
		);
		return true;
	});

export const cancelPoll = userPollAdmin
	.mutation()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		if (!poll.isOpen) {
			return false;
		}

		await ctx.db.patch('userPolls', args.pollId, {
			isOpen: false,
			closedAt: null,
			updatedAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.userPoll.jobs.cleanup.cleanupPollVotes, {
			pollIds: [args.pollId],
		});
		return true;
	});

export const removePoll = userPollAdmin
	.mutation()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		assertUserPollOwner(poll, ctx.user.subject);
		assertUserPollEditable(poll);
		await ctx.db.delete('userPolls', args.pollId);
		await ctx.scheduler.runAfter(0, internal.userPoll.jobs.cleanup.cleanupPollVotes, {
			pollIds: [args.pollId],
		});
		return true;
	});
