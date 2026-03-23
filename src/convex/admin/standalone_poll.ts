import { internal } from '$convex/_generated/api';
import type { MutationCtx } from '$convex/_generated/server';
import { c } from '$convex/helpers';
import { authed } from '$convex/helpers/auth';
import { getStandaloneVotersCounter, getStandaloneVotesCounter } from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	assertStandalonePollEditable,
	assertStandalonePollOwner,
	buildStandalonePollResultSnapshot,
	getLatestStandalonePollResultSnapshot,
	getStandalonePollOrThrow,
	type StandaloneOptionTotal,
} from '$convex/helpers/standalone_poll';
import { ABSTAIN_OPTION_LABEL, minimumVotesForMajority } from '$lib/polls';
import {
	FullStandalonePollSchema,
	PollDraftSchema,
	PollTypeSchema,
	StandalonePollBaseSchema,
	StandaloneVisibilitySchema,
} from '$lib/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

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

export const create_poll = standalone_admin
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
			.safeParse(draft);
		AppError.assertZodSuccess(validated, appErrors.invalid_poll_draft);

		return await ctx.db.insert('standalonePolls', validated.data);
	});

export const list_my_polls = standalone_admin.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('standalonePolls')
		.withIndex('by_ownerUserId_and_updatedAt', (q) => q.eq('ownerUserId', ctx.user.subject))
		.order('desc')
		.collect();
});

export const get_poll = standalone_admin
	.query()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		return poll;
	});

export const edit_poll = standalone_admin
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

export const open_poll = standalone_admin
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

export const close_poll = standalone_admin
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
			internal.admin.standalone_poll.create_poll_result_snapshot_action,
			{
				pollId: args.pollId,
			},
		);
		return true;
	});

export const cancel_poll = standalone_admin
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
		await ctx.scheduler.runAfter(0, internal.admin.standalone_poll.cleanup_poll_votes, {
			pollIds: [args.pollId],
		});
		return true;
	});

export const remove_poll = standalone_admin
	.mutation()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		assertStandalonePollOwner(poll, ctx.user.subject);
		assertStandalonePollEditable(poll);
		await ctx.db.delete('standalonePolls', args.pollId);
		await ctx.scheduler.runAfter(0, internal.admin.standalone_poll.cleanup_poll_votes, {
			pollIds: [args.pollId],
		});
		return true;
	});

export const cleanup_poll_votes = c
	.mutation()
	.input({ pollIds: z.array(zid('standalonePolls')) })
	.internal(async ({ ctx, args }) => {
		let deleted = 0;
		for (const pollId of args.pollIds) {
			const votes = await ctx.db
				.query('standalonePollVotes')
				.withIndex('by_poll', (q) => q.eq('pollId', pollId))
				.collect();
			await Promise.all(votes.map((vote) => ctx.db.delete('standalonePollVotes', vote._id)));
			await Promise.all([
				getStandaloneVotesCounter(pollId).reset(ctx),
				getStandaloneVotersCounter(pollId).reset(ctx),
			]);
			deleted += votes.length;
		}
		return { deleted };
	});

export const get_poll_results = c
	.query()
	.input({ pollId: zid('standalonePolls') })
	.internal(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		const votes = await ctx.db
			.query('standalonePollVotes')
			.withIndex('by_poll', (q) => q.eq('pollId', poll._id))
			.collect();

		const optionTotals = poll.options.map((option, optionIndex) => ({
			optionIndex,
			option,
			votes: 0,
		}));
		for (const vote of votes) {
			if (vote.optionIndex >= 0 && vote.optionIndex < optionTotals.length) {
				optionTotals[vote.optionIndex].votes += 1;
			}
		}

		const options = (
			poll.allowsAbstain
				? optionTotals.filter((o) => o.option !== ABSTAIN_OPTION_LABEL)
				: optionTotals
		).toSorted((a, b) => b.votes - a.votes);
		const usableVotes = options.reduce((acc, o) => acc + o.votes, 0);

		let winners: StandaloneOptionTotal[];
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
			complete: true,
			results: {
				optionTotals,
				winners,
				isTie,
				majorityRule,
				counts: {
					totalVotes: votes.length,
					usableVotes,
					abstain: votes.length - votesWithoutAbstain,
				},
			},
		};
	});

export const insert_poll_result_snapshot = c
	.mutation()
	.input({
		poll: FullStandalonePollSchema,
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
				usableVotes: z.number(),
				abstain: z.number(),
			}),
		}),
	})
	.internal(async ({ ctx, args }) => {
		if (args.poll.closedAt == null) {
			return false;
		}

		const latestSnapshot = await getLatestStandalonePollResultSnapshot(ctx.db, args.poll._id);
		if (latestSnapshot?.closedAt === args.poll.closedAt) {
			return false;
		}

		await ctx.db.insert('standalonePollResults', buildStandalonePollResultSnapshot(args));
		return true;
	});

export const create_poll_result_snapshot_action = c
	.action()
	.input({ pollId: zid('standalonePolls') })
	.internal(async ({ ctx, args }): Promise<boolean> => {
		const results = await ctx.runQuery(internal.admin.standalone_poll.get_poll_results, {
			pollId: args.pollId,
		});
		if (results.poll.isOpen || results.poll.closedAt == null) {
			return false;
		}
		return await ctx.runMutation(
			internal.admin.standalone_poll.insert_poll_result_snapshot,
			results,
		);
	});
