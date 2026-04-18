/**
 * Standalone poll infosida via SvelteKit remote `query` (HTTP-friendly polling).
 */
import { query } from '$app/server';
import { api } from '@lsnd-mt/convex/_generated/api';
import { appErrors } from '@lsnd-mt/common/appError';
import { z } from 'zod';

import { getConvexClient } from '$lib/server/convex';
import { getCurrentUser } from '$lib/server/auth';
import { convexCatchToResult } from '$lib/server/convexCatchToResult';

function logRemote(status: 'ok' | 'err', extra: Record<string, unknown>) {
	if (status === 'ok') {
		return;
	}
	console.info('[user_poll_info_remote]', { status, ...extra });
}

export const getPollInfoPage = query(
	z.object({
		code: z.string().trim().min(4),
	}),
	async (input) => {
		let pollId: string | undefined;
		try {
			const convex = getConvexClient();
			const info = await convex.query(api.userPoll.public.getInfoPageByCode, {
				code: input.code,
			});
			pollId = info.id;

			if (info.visibilityMode === 'account_required') {
				const user = await getCurrentUser();
				if (!user) {
					const err = appErrors.illegal_user_poll_action('auth_required');
					logRemote('err', { code: input.code, appErrorCode: err.code });
					return err.toResult();
				}
			}

			logRemote('ok', { pollId: info.id });
			return { ok: true as const, info };
		} catch (e) {
			const out = convexCatchToResult(e, 'user_poll_info_remote');
			logRemote('err', { pollId, appErrorCode: out.error.code });
			return out;
		}
	},
);
