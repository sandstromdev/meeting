import { command, query } from '$app/server';
import { api } from '$convex/_generated/api';
import { RefineStandalonePollDraftSchema, UserPollDraftPartialSchema } from '$lib/validation';
import { getConvexClient } from '$lib/server/convex';
import { convexCatchToResult } from '$lib/server/convexCatchToResult';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

function logRemote(kind: string, status: 'ok' | 'err', extra: Record<string, unknown>) {
	if (status === 'ok') {
		return;
	}

	console.info('[dashboard_polls_remote]', { kind, status, ...extra });
}

export const listOwnedPolls = query(async () => {
	try {
		const convex = getConvexClient();
		const polls = await convex.query(api.userPoll.public.getMyOwnedPolls, {});
		logRemote('listOwnedPolls', 'ok', { count: polls.length });
		return { ok: true as const, polls };
	} catch (e) {
		const out = convexCatchToResult(e, 'dashboard_polls_remote');
		logRemote('listOwnedPolls', 'err', { appErrorCode: out.error.code });
		return out;
	}
});

export const getPollResultsSnapshot = query(
	z.object({
		pollId: zid('userPolls'),
	}),
	async (input) => {
		try {
			const convex = getConvexClient();
			const snapshot = await convex.query(api.userPoll.admin.getMyPollResultsSnapshot, {
				pollId: input.pollId,
			});
			logRemote('getPollResultsSnapshot', 'ok', { pollId: input.pollId });
			return { ok: true as const, snapshot };
		} catch (e) {
			const out = convexCatchToResult(e, 'dashboard_polls_remote');
			logRemote('getPollResultsSnapshot', 'err', {
				pollId: input.pollId,
				appErrorCode: out.error.code,
			});
			return out;
		}
	},
);

export const watchOwnedPollMetrics = query(
	z.object({
		pollIds: z.array(zid('userPolls')).max(50),
	}),
	async (input) => {
		try {
			const convex = getConvexClient();
			const metrics = await convex.query(api.userPoll.admin.watchOwnedPollMetrics, {
				pollIds: input.pollIds,
			});
			logRemote('watchOwnedPollMetrics', 'ok', { count: metrics.length });
			return { ok: true as const, metrics };
		} catch (e) {
			const out = convexCatchToResult(e, 'dashboard_polls_remote');
			logRemote('watchOwnedPollMetrics', 'err', { appErrorCode: out.error.code });
			return out;
		}
	},
);

export const createPoll = command(
	z.object({
		draft: RefineStandalonePollDraftSchema,
	}),
	async (input) => {
		try {
			const convex = getConvexClient();
			await convex.mutation(api.userPoll.admin.createPoll, input);
			logRemote('createPoll', 'ok', {});
			return { ok: true as const };
		} catch (e) {
			const out = convexCatchToResult(e, 'dashboard_polls_remote');
			logRemote('createPoll', 'err', { appErrorCode: out.error.code });
			return out;
		}
	},
);

export const editPoll = command(
	z.object({
		pollId: zid('userPolls'),
		edits: UserPollDraftPartialSchema,
	}),
	async (input) => {
		try {
			const convex = getConvexClient();
			await convex.mutation(api.userPoll.admin.editPoll, input);
			logRemote('editPoll', 'ok', { pollId: input.pollId });

			await listOwnedPolls().refresh();

			return { ok: true as const };
		} catch (e) {
			const out = convexCatchToResult(e, 'dashboard_polls_remote');
			logRemote('editPoll', 'err', { pollId: input.pollId, appErrorCode: out.error.code });
			return out;
		}
	},
);

function createPollActionCommand(
	kind: 'openPoll' | 'closePoll' | 'cancelPoll' | 'duplicatePoll' | 'removePoll',
	mutation:
		| typeof api.userPoll.admin.openPoll
		| typeof api.userPoll.admin.closePoll
		| typeof api.userPoll.admin.cancelPoll
		| typeof api.userPoll.admin.duplicatePoll
		| typeof api.userPoll.admin.removePoll,
) {
	return command(
		z.object({
			pollId: zid('userPolls'),
		}),
		async (input) => {
			try {
				const convex = getConvexClient();
				await convex.mutation(mutation, input);
				logRemote(kind, 'ok', { pollId: input.pollId });
				await listOwnedPolls().refresh();
				return { ok: true as const };
			} catch (e) {
				const out = convexCatchToResult(e);
				logRemote(kind, 'err', { pollId: input.pollId, appErrorCode: out.error.code });
				return out;
			}
		},
	);
}

export const openPoll = createPollActionCommand('openPoll', api.userPoll.admin.openPoll);
export const closePoll = createPollActionCommand('closePoll', api.userPoll.admin.closePoll);
export const cancelPoll = createPollActionCommand('cancelPoll', api.userPoll.admin.cancelPoll);
export const duplicatePoll = createPollActionCommand(
	'duplicatePoll',
	api.userPoll.admin.duplicatePoll,
);
export const removePoll = createPollActionCommand('removePoll', api.userPoll.admin.removePoll);
