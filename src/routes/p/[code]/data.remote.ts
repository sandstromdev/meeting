/**
 * Standalone poll voting via SvelteKit remote functions (same-origin HTTP).
 * Rate limiting: deferred (see docs/features/poll-voting-over-http.md).
 * idempotencyKey is accepted on writes for forward compatibility; dedup is not implemented (v1).
 */
import { command, query } from '$app/server';
import { api } from '$convex/_generated/api';
import { AppError, getAppError } from '$convex/helpers/error';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

import { getConvexClient } from '$lib/server/convex';
import { getCurrentUser } from '$lib/server/auth';

export type PollRemoteErrorCode =
	| 'UNAUTHENTICATED'
	| 'FORBIDDEN'
	| 'POLL_CLOSED'
	| 'INVALID_OPTION'
	| 'NOT_FOUND'
	| 'BAD_REQUEST'
	| 'INTERNAL';

export type PollRemoteError = { ok: false; code: PollRemoteErrorCode; message: string };

const GetPollByCodeSchema = z.object({
	code: z.string().trim().min(4),
	voterSessionToken: z.string().nullable().optional(),
});

const VoteSchema = z.object({
	pollId: zid('userPolls'),
	optionIndexes: z.array(z.number().int().nonnegative()).min(1),
	voterSessionToken: z.string().nullable().optional(),
	idempotencyKey: z.string().optional(),
});

const RetractVoteSchema = z.object({
	pollId: zid('userPolls'),
	voterSessionToken: z.string().nullable().optional(),
	idempotencyKey: z.string().optional(),
});

function appErrorPayload(err: AppError): Record<string, unknown> {
	const d = err.data as {
		type?: string;
		code?: string;
		data?: Record<string, unknown>;
	};
	return (d?.data ?? {}) as Record<string, unknown>;
}

function convexErrorToRemote(err: unknown): PollRemoteError {
	const appErr = getAppError(err);
	if (appErr) {
		if (appErr.is('unauthorized')) {
			return { ok: false, code: 'UNAUTHENTICATED', message: 'Unauthorized' };
		}
		if (appErr.is('forbidden')) {
			return { ok: false, code: 'FORBIDDEN', message: 'Forbidden' };
		}
		if (appErr.is('user_poll_not_found') || appErr.is('user_poll_code_not_found')) {
			return { ok: false, code: 'NOT_FOUND', message: 'Not found' };
		}
		if (appErr.is('invalid_poll_option')) {
			return { ok: false, code: 'INVALID_OPTION', message: 'Invalid option' };
		}
		if (appErr.is('zod_error')) {
			return { ok: false, code: 'BAD_REQUEST', message: 'Invalid request' };
		}
		if (appErr.is('illegal_user_poll_action')) {
			const action = appErrorPayload(appErr).action;
			if (action === 'vote_while_closed') {
				return { ok: false, code: 'POLL_CLOSED', message: 'Poll closed' };
			}
			if (action === 'auth_required') {
				return { ok: false, code: 'UNAUTHENTICATED', message: 'Authentication required' };
			}
			if (
				action === 'too_many_votes' ||
				action === 'duplicate_vote_option' ||
				action === 'missing_session_key'
			) {
				return { ok: false, code: 'INVALID_OPTION', message: 'Invalid vote' };
			}
			return { ok: false, code: 'BAD_REQUEST', message: 'Invalid action' };
		}
		if (appErr.is('bad_request')) {
			return { ok: false, code: 'BAD_REQUEST', message: 'Bad request' };
		}
	}

	console.error('[user_poll_remote] unexpected_error', err);
	return { ok: false, code: 'INTERNAL', message: 'Internal error' };
}

function logRemote(
	kind: 'vote' | 'retractVote' | 'getPollByCode',
	status: 'ok' | 'err',
	extra: Record<string, unknown>,
) {
	console.info('[user_poll_remote]', { kind, status, ...extra });
}

export const getPollByCode = query(GetPollByCodeSchema, async (input) => {
	const convex = getConvexClient();
	let poll;
	try {
		poll = await convex.query(api.userPoll.public.getByCode, {
			code: input.code,
			voterSessionToken: input.voterSessionToken,
		});
	} catch (e) {
		const err = convexErrorToRemote(e);
		logRemote('getPollByCode', 'err', { code: input.code, errorCode: err.code });
		return err;
	}

	if (poll.visibilityMode === 'account_required') {
		const user = await getCurrentUser();
		if (!user) {
			const out: PollRemoteError = {
				ok: false,
				code: 'UNAUTHENTICATED',
				message: 'Authentication required',
			};
			logRemote('getPollByCode', 'err', { code: input.code, errorCode: out.code });
			return out;
		}
	}

	try {
		const voteCounts = await convex.query(api.userPoll.public.getVoteCounts, {
			pollId: poll.id,
		});
		logRemote('getPollByCode', 'ok', { pollId: poll.id });
		return { ok: true as const, poll, voteCounts };
	} catch (e) {
		const err = convexErrorToRemote(e);
		logRemote('getPollByCode', 'err', { pollId: poll.id, errorCode: err.code });
		return err;
	}
});

export const vote = command(VoteSchema, async (input) => {
	const convex = getConvexClient();
	try {
		await convex.mutation(api.userPoll.public.vote, {
			pollId: input.pollId,
			optionIndexes: input.optionIndexes,
			voterSessionToken: input.voterSessionToken,
		});
	} catch (e) {
		const err = convexErrorToRemote(e);
		logRemote('vote', 'err', { pollId: input.pollId, errorCode: err.code });
		return err;
	}
	logRemote('vote', 'ok', { pollId: input.pollId });
	return { ok: true as const };
});

export const retractVote = command(RetractVoteSchema, async (input) => {
	const convex = getConvexClient();
	try {
		await convex.mutation(api.userPoll.public.retractVote, {
			pollId: input.pollId,
			voterSessionToken: input.voterSessionToken,
		});
	} catch (e) {
		const err = convexErrorToRemote(e);
		logRemote('retractVote', 'err', { pollId: input.pollId, errorCode: err.code });
		return err;
	}
	logRemote('retractVote', 'ok', { pollId: input.pollId });
	return { ok: true as const };
});
