import { internal } from '$convex/_generated/api';
import type { MutationCtx } from '$convex/_generated/server';
import { authed } from '$convex/helpers/auth';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertStandalonePollEditable,
	assertStandalonePollOwner,
	getStandalonePollOrThrow,
} from '$convex/helpers/standalone_poll';
import { ABSTAIN_OPTION_LABEL } from '$lib/polls';
import {
	FullStandalonePollSchema,
	PollDraftSchema,
	PollTypeSchema,
	refinePollRowTypeConfig,
	StandalonePollBaseSchema,
	StandaloneVisibilitySchema,
} from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';

function optionsWithAbstainLast(options: string[], allowsAbstain: boolean): string[] {
	const withoutAbstain = options.filter((o) => o !== ABSTAIN_OPTION_LABEL);
	return allowsAbstain ? [...withoutAbstain, ABSTAIN_OPTION_LABEL] : withoutAbstain;
}

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
			.query('standalonePolls')
			.withIndex('by_code', (q) => q.eq('code', code))
			.unique();
		if (!existing) {
			return code;
		}
	}
	throw appErrors.internal_error();
}

const standalone_admin = authed.use(({ ctx, next }) => {
	AppError.assert(ctx.user.role === 'admin', appErrors.forbidden());
	return next(ctx);
});

// --- Public queries ---

export const listMyPolls = standalone_admin.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('standalonePolls')
		.withIndex('by_ownerUserId_and_updatedAt', (q) => q.eq('ownerUserId', ctx.user.subject))
		.order('desc')
		.collect();
});

export const getPoll = standalone_admin
	.query()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		return poll;
	});

// --- Public mutations ---

export const createPoll = standalone_admin
	.mutation()
	.input({
		draft: PollDraftSchema,
		visibilityMode: StandaloneVisibilitySchema,
	})
	.public(async ({ ctx, args }) => {
		const draft = {
			...args.draft,
			code: await createUniqueCode(ctx),
			ownerUserId: ctx.user.subject,
			visibilityMode: args.visibilityMode,
			isOpen: false,
			updatedAt: Date.now(),
			openedAt: null,
			closedAt: null,
			options: optionsWithAbstainLast(args.draft.options, args.draft.allowsAbstain),
		};

		const validated = StandalonePollBaseSchema.omit({ _id: true, _creationTime: true })
			.and(PollTypeSchema)
			.superRefine((data, ctx) => refinePollRowTypeConfig(data, ctx))
			.safeParse(draft);
		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		return await ctx.db.insert('standalonePolls', validated.data);
	});

export const editPoll = standalone_admin
	.mutation()
	.input({
		pollId: zid('standalonePolls'),
		edits: PollDraftSchema.partial().extend({
			visibilityMode: StandaloneVisibilitySchema.optional(),
		}),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		assertStandalonePollEditable(poll);

		const nextAllowsAbstain = args.edits.allowsAbstain ?? poll.allowsAbstain;
		const rawOptions = args.edits.options ?? poll.options;
		const options = optionsWithAbstainLast(rawOptions, nextAllowsAbstain);
		const updatedFields = {
			...poll,
			...args.edits,
			options,
			updatedAt: Date.now(),
		};

		const validated = FullStandalonePollSchema.safeParse(Object.assign({}, poll, updatedFields));
		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		await ctx.db.replace('standalonePolls', args.pollId, validated.data);
		return true;
	});

export const openPoll = standalone_admin
	.mutation()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		if (poll.isOpen) {
			return false;
		}

		await ctx.db.patch('standalonePolls', args.pollId, {
			isOpen: true,
			openedAt: Date.now(),
			closedAt: null,
			updatedAt: Date.now(),
		});
		return true;
	});

export const closePoll = standalone_admin
	.mutation()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		if (!poll.isOpen) {
			return false;
		}

		const now = Date.now();
		await ctx.db.patch('standalonePolls', args.pollId, {
			isOpen: false,
			closedAt: now,
			updatedAt: now,
		});
		await ctx.scheduler.runAfter(
			0,
			internal.polls.jobs.standalone_polls.createPollResultSnapshotAction,
			{
				pollId: args.pollId,
			},
		);
		return true;
	});

export const cancelPoll = standalone_admin
	.mutation()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		if (!poll.isOpen) {
			return false;
		}

		await ctx.db.patch('standalonePolls', args.pollId, {
			isOpen: false,
			closedAt: null,
			updatedAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.polls.jobs.standalone_polls.cleanupPollVotes, {
			pollIds: [args.pollId],
		});
		return true;
	});

export const removePoll = standalone_admin
	.mutation()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		assertStandalonePollEditable(poll);
		await ctx.db.delete('standalonePolls', args.pollId);
		await ctx.scheduler.runAfter(0, internal.polls.jobs.standalone_polls.cleanupPollVotes, {
			pollIds: [args.pollId],
		});
		return true;
	});
