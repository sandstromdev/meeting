import { c } from '$convex/helpers';
import { authed } from '$convex/helpers/auth';
import { getUserPollVotesCounter, getUserPollVotersCounter } from '$convex/helpers/counters';
import { AppError, appErrors } from '$convex/helpers/error';
import { assertValidPollVoteOptionIndexes } from '$convex/helpers/poll';
import {
	getLatestUserPollResultSnapshot,
	getUserPollOrThrow,
	getVoterKey,
} from '$convex/helpers/userPoll';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

export const getByCode = c
	.query()
	.input({
		code: z.string().trim().min(4),
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await ctx.db
			.query('userPolls')
			.withIndex('by_code', (q) => q.eq('code', args.code.toUpperCase()))
			.unique();

		AppError.assertNotNull(poll, appErrors.user_poll_code_not_found(args.code));

		const identity = await ctx.auth.getUserIdentity();

		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionToken).catch(
			() => null,
		);

		const myVotes = voterKey
			? await ctx.db
					.query('userPollVotes')
					.withIndex('by_poll_and_voterKey', (q) =>
						q.eq('pollId', poll._id).eq('voterKey', voterKey),
					)
					.collect()
			: [];

		const latestResult =
			!poll.isOpen && poll.closedAt != null
				? await getLatestUserPollResultSnapshot(ctx.db, poll._id)
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

export const getVoteCounts = c
	.query()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);

		if (poll.visibilityMode === 'account_required') {
			const identity = await ctx.auth.getUserIdentity();
			AppError.assertNotNull(identity, appErrors.illegal_user_poll_action('auth_required'));
		}

		const [votesCount, votersCount] = await Promise.all([
			getUserPollVotesCounter(args.pollId).count(ctx),
			getUserPollVotersCounter(args.pollId).count(ctx),
		]);

		return { votesCount, votersCount };
	});

export const getResultsByPollId = c
	.query()
	.input({ pollId: zid('userPolls') })
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		if (poll.isOpen || poll.closedAt == null) {
			return null;
		}

		const result = await getLatestUserPollResultSnapshot(ctx.db, poll._id);
		if (!result || !poll.isResultPublic) {
			return null;
		}

		return {
			pollId: poll._id,
			complete: result.complete,
			results: result.results,
		};
	});

export const getMyOwnedPolls = authed.query().public(async ({ ctx }) => {
	return await ctx.db
		.query('userPolls')
		.withIndex('by_ownerUserId_and_updatedAt', (q) => q.eq('ownerUserId', ctx.user.subject))
		.order('desc')
		.collect();
});

// --- Public mutations ---

export const vote = c
	.mutation()
	.input({
		pollId: zid('userPolls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		AppError.assert(poll.isOpen, appErrors.illegal_user_poll_action('vote_while_closed'));

		const uniqueOptionIndexes = assertValidPollVoteOptionIndexes(poll, args.optionIndexes, 'user');

		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionToken ?? null);
		const existingVotes = await ctx.db
			.query('userPollVotes')
			.withIndex('by_poll_and_voterKey', (q) =>
				q.eq('pollId', args.pollId).eq('voterKey', voterKey),
			)
			.collect();

		if (existingVotes.length > 0) {
			await Promise.all(existingVotes.map((vote) => ctx.db.delete('userPollVotes', vote._id)));
			await getUserPollVotesCounter(args.pollId).subtract(ctx, existingVotes.length);
		}

		await Promise.all(
			uniqueOptionIndexes.map((optionIndex) =>
				ctx.db.insert('userPollVotes', {
					pollId: args.pollId,
					voterKey,
					optionIndex,
				}),
			),
		);

		const counterUpdates: Promise<unknown>[] = [
			getUserPollVotesCounter(args.pollId).add(ctx, uniqueOptionIndexes.length),
		];
		if (existingVotes.length === 0) {
			counterUpdates.push(getUserPollVotersCounter(args.pollId).inc(ctx));
		}
		await Promise.all(counterUpdates);

		return true;
	});

export const retractVote = c
	.mutation()
	.input({
		pollId: zid('userPolls'),
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await getUserPollOrThrow(ctx.db, args.pollId);
		AppError.assert(poll.isOpen, appErrors.illegal_user_poll_action('vote_while_closed'));
		const voterKey = await getVoterKey(ctx, poll.visibilityMode, args.voterSessionToken ?? null);

		const existingVotes = await ctx.db
			.query('userPollVotes')
			.withIndex('by_poll_and_voterKey', (q) =>
				q.eq('pollId', args.pollId).eq('voterKey', voterKey),
			)
			.collect();
		if (existingVotes.length === 0) {
			return true;
		}

		await Promise.all(existingVotes.map((vote) => ctx.db.delete('userPollVotes', vote._id)));
		await getUserPollVotesCounter(args.pollId).subtract(ctx, existingVotes.length);
		await getUserPollVotersCounter(args.pollId).dec(ctx);
		return true;
	});
