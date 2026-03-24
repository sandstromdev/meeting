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

async function getVoterKey(
	ctx: {
		auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
	},
	pollVisibilityMode: 'public' | 'account_required',
	voterSessionToken?: string | null,
) {
	if (pollVisibilityMode === 'account_required') {
		const identity = await ctx.auth.getUserIdentity();
		AppError.assertNotNull(identity, appErrors.illegal_standalone_poll_action('auth_required'));
		return `user:${identity.subject}`;
	}

	AppError.assert(
		voterSessionToken != null,
		appErrors.illegal_standalone_poll_action('missing_session_key'),
	);
	return `session:${voterSessionToken}`;
}

export const get_by_code = c
	.query()
	.input({
		code: z.string().trim().min(4),
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await ctx.db
			.query('standalonePolls')
			.withIndex('by_code', (q) => q.eq('code', args.code.toUpperCase()))
			.unique();

		AppError.assertNotNull(poll, appErrors.standalone_poll_code_not_found(args.code));

		const identity = await ctx.auth.getUserIdentity();

		if (poll.visibilityMode === 'account_required') {
			AppError.assertNotNull(identity, appErrors.illegal_standalone_poll_action('auth_required'));
		}

		const voterKey = await getVoterKey(
			ctx,
			poll.visibilityMode,
			args.voterSessionToken ?? null,
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

		const canSeeOptionTotals =
			!poll.isOpen &&
			poll.closedAt != null &&
			(poll.isResultPublic || identity?.subject === poll.ownerUserId);

		return {
			id: poll._id,
			code: poll.code,
			title: poll.title,
			options: poll.options,
			type: poll.type,
			isOpen: poll.isOpen,
			isResultPublic: poll.isResultPublic,
			allowsAbstain: poll.allowsAbstain,
			ownerUserId: poll.ownerUserId,
			maxVotesPerVoter: poll.maxVotesPerVoter,
			visibilityMode: poll.visibilityMode,
			hasVoted: myVotes.length > 0,
			myVoteOptionIndexes: myVotes.map((vote) => vote.optionIndex),
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

export const get_vote_counts = c
	.query()
	.input({ pollId: zid('standalonePolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);

		if (poll.visibilityMode === 'account_required') {
			const identity = await ctx.auth.getUserIdentity();
			AppError.assertNotNull(identity, appErrors.illegal_standalone_poll_action('auth_required'));
		}

		const [votesCount, votersCount] = await Promise.all([
			getStandaloneVotesCounter(args.pollId).count(ctx),
			getStandaloneVotersCounter(args.pollId).count(ctx),
		]);

		return { votesCount, votersCount };
	});

export const vote = c
	.mutation()
	.input({
		pollId: zid('standalonePolls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
		voterSessionToken: z.string().nullable().optional(),
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

		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionToken ?? null);
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
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getStandalonePollOrThrow(ctx.db, args.pollId);
		AppError.assert(poll.isOpen, appErrors.illegal_standalone_poll_action('vote_while_closed'));
		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionToken ?? null);

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
