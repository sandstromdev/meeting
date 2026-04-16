/**
 * Standalone poll voting via SvelteKit remote functions (same-origin HTTP).
 * Rate limiting: deferred (see docs/features/poll-voting-over-http.md).
 * idempotencyKey is accepted on writes for forward compatibility; dedup is not implemented (v1).
 */
import { command, query } from '$app/server';
import { api } from '@lsnd/convex/_generated/api';
import { type AppError, appErrors, getAppError } from '@lsnd/convex/helpers/error';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

import { getConvexClient } from '$lib/server/convex';
import { getCurrentUser } from '$lib/server/auth';

function convexCatchToResult(e: unknown): { ok: false; error: AppError } {
	const appErr = getAppError(e);
	if (!appErr) {
		console.error('[user_poll_remote] unexpected_error', e);
	}
	const err = appErr ?? appErrors.internal_error();
	return { ok: false, error: err };
}

function logRemote(
	kind: 'vote' | 'retractVote' | 'getPollByCode',
	status: 'ok' | 'err',
	extra: Record<string, unknown>,
) {
	if (status === 'ok') {
		return;
	}

	console.info('[user_poll_remote]', { kind, status, ...extra });
}

export const getPollByCode = query(
	z.object({
		code: z.string().trim().min(4),
		voterSessionToken: z.string().nullable().optional(),
	}),
	async (input) => {
		let pollId;
		try {
			const convex = getConvexClient();
			const poll = await convex.query(api.userPoll.public.getByCode, {
				code: input.code,
				voterSessionToken: input.voterSessionToken,
			});

			pollId = poll.id;

			if (poll.visibilityMode === 'account_required') {
				const user = await getCurrentUser();
				if (!user) {
					const err = appErrors.illegal_user_poll_action('auth_required');
					logRemote('getPollByCode', 'err', { code: input.code, appErrorCode: err.code });
					return err.toResult();
				}
			}

			logRemote('getPollByCode', 'ok', { pollId: poll.id });
			return { ok: true as const, poll };
		} catch (e) {
			const out = convexCatchToResult(e);
			logRemote('getPollByCode', 'err', { pollId, appErrorCode: out.error.code });
			return out;
		}
	},
);

export const vote = command(
	z.object({
		pollId: zid('userPolls'),
		optionIndexes: z.array(z.number().int().nonnegative()).min(1),
		voterSessionToken: z.string().nullable().optional(),
		idempotencyKey: z.string().optional(),
	}),
	async (input) => {
		const convex = getConvexClient();
		try {
			await convex.mutation(api.userPoll.public.vote, {
				pollId: input.pollId,
				optionIndexes: input.optionIndexes,
				voterSessionToken: input.voterSessionToken,
			});
		} catch (e) {
			const out = convexCatchToResult(e);
			logRemote('vote', 'err', { pollId: input.pollId, appErrorCode: out.error.code });
			return out;
		}
		logRemote('vote', 'ok', { pollId: input.pollId });
		return { ok: true as const };
	},
);

export const retractVote = command(
	z.object({
		pollId: zid('userPolls'),
		voterSessionToken: z.string().nullable().optional(),
		idempotencyKey: z.string().optional(),
	}),
	async (input) => {
		const convex = getConvexClient();
		try {
			await convex.mutation(api.userPoll.public.retractVote, {
				pollId: input.pollId,
				voterSessionToken: input.voterSessionToken,
			});
		} catch (e) {
			const out = convexCatchToResult(e);
			logRemote('retractVote', 'err', { pollId: input.pollId, appErrorCode: out.error.code });
			return out;
		}
		logRemote('retractVote', 'ok', { pollId: input.pollId });
		return { ok: true as const };
	},
);
