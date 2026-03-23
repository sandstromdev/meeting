import { c } from '$convex/helpers';
import { authed } from '$convex/helpers/auth';
import { getStandaloneVotesCounter, getStandaloneVotersCounter } from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import {
	getLatestStandalonePollResultSnapshot,
	getStandalonePollOrThrow,
} from '$convex/helpers/standalone_poll';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

function normalizeVoterSessionKey(input: string | null | undefined) {
	const value = input?.trim();
	return value && value.length > 0 ? value : null;
}

async function getVoterKey(
	ctx: {
		auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
	},
	pollVisibilityMode: 'public' | 'account_required',
	voterSessionKey?: string | null,
) {
	if (pollVisibilityMode === 'account_required') {
		const identity = await ctx.auth.getUserIdentity();
		AppError.assertNotNull(identity, appErrors.illegal_standalone_poll_action('auth_required'));
		return `user:${identity.subject}`;
	}

	const normalizedKey = normalizeVoterSessionKey(voterSessionKey);
	AppError.assert(
		normalizedKey != null,
		appErrors.illegal_standalone_poll_action('missing_session_key'),
	);
	return `session:${normalizedKey}`;
}

export const get_by_code = c
	.query()
	.input({
		code: z.string().trim().min(4),
		voterSessionKey: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await ctx.db
			.query('standalonePolls')
			.withIndex('by_code', (q) => q.eq('code', args.code.toUpperCase()))
			.unique();
		AppError.assertNotNull(poll, appErrors.standalone_poll_code_not_found(args.code));

		const [votesCount, votersCount] = await Promise.all([
			getStandaloneVotesCounter(poll._id).count(ctx),
			getStandaloneVotersCounter(poll._id).count(ctx),
		]);

		const voterKey = await getVoterKey(
			ctx,
			poll.visibilityMode,
			args.voterSessionKey ?? null,
		).catch(() => null);
		const myVotes = voterKey
			? await ctx.db
					.query('standalonePollVotes')
					.withIndex('by_poll_and_voterKey', (q) =>
						q.eq('pollId', poll._id).eq('voterKey', voterKey),
					)
					.collect()
			: [];

		const latestResult =
			!poll.isOpen && poll.closedAt != null
				? await getLatestStandalonePollResultSnapshot(ctx.db, poll._id)
				: null;
		const canSeeOptionTotals = !poll.isOpen && poll.closedAt != null && poll.isResultPublic;

		return {
			id: poll._id,
			code: poll.code,
			title: poll.title,
			options: poll.options,
			type: poll.type,
			isOpen: poll.isOpen,
			isResultPublic: poll.isResultPublic,
			allowsAbstain: poll.allowsAbstain,
			maxVotesPerVoter: poll.maxVotesPerVoter,
			visibilityMode: poll.visibilityMode,
			hasVoted: myVotes.length > 0,
			myVoteOptionIndexes: myVotes.map((vote) => vote.optionIndex),
			votesCount,
			votersCount,
			results:
				latestResult && canSeeOptionTotals
					? {
							winners: latestResult.results.winners,
							optionTotals: latestResult.results.optionTotals,
							isTie: latestResult.results.isTie,
							majorityRule: latestResult.results.majorityRule,
							counts: latestResult.results.counts,
						}
					: null,
		};
	});

export const vote = c
	.mutation()
	.input({
		pollId: zid('standalonePolls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
		voterSessionKey: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		AppError.assert(poll.isOpen, appErrors.illegal_standalone_poll_action('vote_while_closed'));

		const uniqueOptionIndexes = [...new Set(args.optionIndexes)];
		AppError.assert(
			uniqueOptionIndexes.length === args.optionIndexes.length,
			appErrors.illegal_standalone_poll_action('duplicate_vote_option'),
		);

		const maxVotesPerVoter =
			poll.type === 'multi_winner' ? poll.winningCount : poll.maxVotesPerVoter;
		AppError.assert(
			uniqueOptionIndexes.length <= maxVotesPerVoter,
			appErrors.illegal_standalone_poll_action('too_many_votes'),
		);
		for (const optionIndex of uniqueOptionIndexes) {
			AppError.assert(
				optionIndex >= 0 && optionIndex < poll.options.length,
				appErrors.invalid_poll_option(optionIndex),
			);
		}

		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionKey ?? null);
		const existingVotes = await ctx.db
			.query('standalonePollVotes')
			.withIndex('by_poll_and_voterKey', (q) =>
				q.eq('pollId', args.pollId).eq('voterKey', voterKey),
			)
			.collect();

		if (existingVotes.length > 0) {
			await Promise.all(
				existingVotes.map((vote) => ctx.db.delete('standalonePollVotes', vote._id)),
			);
			await getStandaloneVotesCounter(args.pollId).subtract(ctx, existingVotes.length);
		}

		await Promise.all(
			uniqueOptionIndexes.map((optionIndex) =>
				ctx.db.insert('standalonePollVotes', {
					pollId: args.pollId,
					voterKey,
					optionIndex,
				}),
			),
		);

		const counterUpdates: Promise<unknown>[] = [
			getStandaloneVotesCounter(args.pollId).add(ctx, uniqueOptionIndexes.length),
		];
		if (existingVotes.length === 0) {
			counterUpdates.push(getStandaloneVotersCounter(args.pollId).inc(ctx));
		}
		await Promise.all(counterUpdates);

		return true;
	});

export const retract_vote = c
	.mutation()
	.input({
		pollId: zid('standalonePolls'),
		voterSessionKey: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		AppError.assert(poll.isOpen, appErrors.illegal_standalone_poll_action('vote_while_closed'));
		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionKey ?? null);

		const existingVotes = await ctx.db
			.query('standalonePollVotes')
			.withIndex('by_poll_and_voterKey', (q) =>
				q.eq('pollId', args.pollId).eq('voterKey', voterKey),
			)
			.collect();
		if (existingVotes.length === 0) {
			return true;
		}

		await Promise.all(existingVotes.map((vote) => ctx.db.delete('standalonePollVotes', vote._id)));
		await getStandaloneVotesCounter(args.pollId).subtract(ctx, existingVotes.length);
		await getStandaloneVotersCounter(args.pollId).dec(ctx);
		return true;
	});

export const get_results_by_poll_id = c
	.query()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		if (poll.isOpen || poll.closedAt == null) {
			return null;
		}

		const result = await getLatestStandalonePollResultSnapshot(ctx.db, poll._id);
		if (!result || !poll.isResultPublic) {
			return null;
		}

		return {
			pollId: poll._id,
			complete: result.complete,
			results: result.results,
		};
	});

export const get_my_owned_polls = authed.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('standalonePolls')
		.withIndex('by_ownerUserId_and_updatedAt', (q) => q.eq('ownerUserId', ctx.user.subject))
		.order('desc')
		.collect();
});
