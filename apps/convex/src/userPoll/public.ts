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
import { buildTieredPollResultsPayload } from '$convex/helpers/pollResultPayload';
import { normalizeStoredPollOptions } from '@lsnd-mt/common/pollOptions';
import {
	effectiveResultVisibility,
	syncIsResultPublicFromVisibility,
} from '@lsnd-mt/common/pollResultVisibility';
import { UserPollCodeSchema } from '@lsnd-mt/common/validation';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

// --- Public queries ---

export const getByCode = c
	.query()
	.input({
		code: UserPollCodeSchema,
		voterSessionToken: z.string().nullable().optional(),
	})
	.public(async ({ ctx, args }) => {
		const poll = await ctx.db
			.query('userPolls')
			.withIndex('by_code', (q) => q.eq('code', args.code))
			.unique();

		AppError.assertNotNull(poll, appErrors.user_poll_code_not_found(args.code));

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

		/** Resolved from `poll.resultVisibility` or legacy `isResultPublic` (see `effectiveResultVisibility`). */
		const resultVisibility = effectiveResultVisibility(poll);
		const isClosed = !poll.isOpen && poll.closedAt != null;
		/** `/p/[code]` participant surface: never upgrade via auth/owner; owners use dashboard / `getResultsByPollId`. */
		const canSeeAnyResults = isClosed && latestResult != null && resultVisibility !== 'none';

		const results =
			canSeeAnyResults && latestResult
				? buildTieredPollResultsPayload({
						results: {
							optionTotals: latestResult.results.optionTotals,
							winners: latestResult.results.winners,
							isTie: latestResult.results.isTie,
							majorityRule: latestResult.results.majorityRule,
							counts: latestResult.results.counts,
						},
						effective: resultVisibility,
						isPrivileged: false,
					})
				: null;

		return {
			id: poll._id,
			code: poll.code,
			title: poll.title,
			options: normalizeStoredPollOptions(poll.options),
			type: poll.type,
			isOpen: poll.isOpen,
			/** @deprecated Mirrors `resultVisibility === 'full'`; prefer `resultVisibility`. */
			isResultPublic: syncIsResultPublicFromVisibility(resultVisibility),
			resultVisibility,
			allowsAbstain: poll.allowsAbstain,
			ownerUserId: poll.ownerUserId,
			maxVotesPerVoter: poll.maxVotesPerVoter,
			visibilityMode: poll.visibilityMode,
			hasVoted: myVotes.length > 0,
			myVoteOptionIndexes: myVotes.map((vote) => vote.optionIndex),
			results,
		};
	});

/** Public infosida (`/p/{code}/info`): projector-friendly link, optional live metrics, closed results tiered like `getByCode`. */
export const getInfoPageByCode = c
	.query()
	.input({
		code: UserPollCodeSchema,
	})
	.public(async ({ ctx, args }) => {
		const poll = await ctx.db
			.query('userPolls')
			.withIndex('by_code', (q) => q.eq('code', args.code))
			.unique();

		AppError.assertNotNull(poll, appErrors.user_poll_code_not_found(args.code));

		if (!(poll.infoPageEnabled ?? false)) {
			throw appErrors.user_poll_code_not_found(args.code);
		}

		const resultVisibility = effectiveResultVisibility(poll);
		const isResultPublic = syncIsResultPublicFromVisibility(resultVisibility);

		let votesCount: number | undefined;
		let votersCount: number | undefined;
		if (poll.isOpen && (poll.infoPageShowLiveVoteCounts ?? false)) {
			[votesCount, votersCount] = await Promise.all([
				getUserPollVotesCounter(poll._id).count(ctx),
				getUserPollVotersCounter(poll._id).count(ctx),
			]);
		}

		const isClosed = !poll.isOpen && poll.closedAt != null;
		const latestResult = isClosed ? await getLatestUserPollResultSnapshot(ctx.db, poll._id) : null;

		const canSeeAnyResults = isClosed && latestResult != null && resultVisibility !== 'none';

		const results =
			canSeeAnyResults && latestResult
				? buildTieredPollResultsPayload({
						results: {
							optionTotals: latestResult.results.optionTotals,
							winners: latestResult.results.winners,
							isTie: latestResult.results.isTie,
							majorityRule: latestResult.results.majorityRule,
							counts: latestResult.results.counts,
						},
						effective: resultVisibility,
						isPrivileged: false,
					})
				: null;

		return {
			id: poll._id,
			code: poll.code,
			title: poll.title,
			isOpen: poll.isOpen,
			visibilityMode: poll.visibilityMode,
			resultVisibility,
			/** @deprecated Prefer `resultVisibility`. */
			isResultPublic,
			infoPageEnabled: poll.infoPageEnabled ?? false,
			infoPageShowLiveVoteCounts: poll.infoPageShowLiveVoteCounts ?? false,
			votesCount,
			votersCount,
			results,
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
		if (!result) {
			return null;
		}

		const identity = await ctx.auth.getUserIdentity();
		const isOwner = identity?.subject === poll.ownerUserId;
		const resultVisibility = effectiveResultVisibility(poll);
		if (!isOwner && resultVisibility !== 'full') {
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
