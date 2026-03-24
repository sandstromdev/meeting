import type { Doc, Id } from '$convex/_generated/dataModel';
import type { Auth } from 'convex/server';
import { stripSystemFields } from '.';
import { AppError, appErrors } from './error';
import type { Db } from './types';

export type StandaloneOptionTotal = { optionIndex: number; option: string; votes: number };

type StandalonePollResultSnapshotData = Omit<Doc<'standalonePollResults'>, '_id' | '_creationTime'>;
type StandalonePollResultSnapshotArgs = {
	poll: Doc<'standalonePolls'>;
	complete: boolean;
	results: {
		optionTotals: StandaloneOptionTotal[];
		winners: StandaloneOptionTotal[];
		isTie: boolean;
		majorityRule: Doc<'standalonePollResults'>['results']['majorityRule'] | null;
		counts: {
			totalVotes: number;
			usableVotes: number;
			abstain: number;
		};
	};
};

export function buildStandalonePollResultSnapshot(
	args: StandalonePollResultSnapshotArgs,
): StandalonePollResultSnapshotData {
	const { poll, complete, results } = args;

	return {
		pollId: poll._id,
		closedAt: poll.closedAt ?? Date.now(),
		poll: stripSystemFields(poll),
		complete,
		results,
	};
}

export async function getStandalonePollOrThrow(db: Db, pollId?: Id<'standalonePolls'>) {
	AppError.assertNotNull(pollId, appErrors.bad_request({ pollId }));

	const poll = await db.get('standalonePolls', pollId);
	AppError.assertNotNull(poll, appErrors.standalone_poll_not_found(pollId));
	return poll;
}

export function assertStandalonePollEditable(poll: Pick<Doc<'standalonePolls'>, 'isOpen'>) {
	AppError.assert(!poll.isOpen, appErrors.illegal_standalone_poll_action('edit_while_open'));
}

export function assertStandalonePollOwner(
	poll: Pick<Doc<'standalonePolls'>, 'ownerUserId'>,
	userId: string,
) {
	AppError.assert(poll.ownerUserId === userId, appErrors.forbidden());
}

export async function getLatestStandalonePollResultSnapshot(db: Db, pollId: Id<'standalonePolls'>) {
	return await db
		.query('standalonePollResults')
		.withIndex('by_poll_and_closedAt', (q) => q.eq('pollId', pollId))
		.order('desc')
		.first();
}

export async function getVoterKey(
	ctx: { auth: Auth },
	pollVisibilityMode: 'public' | 'account_required',
	idToken?: string | null,
) {
	let token = idToken;
	if (pollVisibilityMode === 'account_required') {
		const identity = await ctx.auth.getUserIdentity();
		token = identity?.subject;
	}

	AppError.assertNotNull(token, appErrors.illegal_standalone_poll_action('missing_session_key'));

	return formatVoterKey(pollVisibilityMode, token);
}

export async function formatVoterKey(
	pollVisibilityMode: 'public' | 'account_required',
	idToken?: string,
) {
	const hashed = new Uint8Array(
		await crypto.subtle.digest('sha-256', new TextEncoder().encode(idToken)),
	).toHex();

	if (pollVisibilityMode === 'account_required') {
		AppError.assertNotNull(idToken, appErrors.illegal_standalone_poll_action('auth_required'));
		return `user:${hashed}`;
	}

	AppError.assert(idToken != null, appErrors.illegal_standalone_poll_action('missing_session_key'));
	return `session:${hashed}`;
}
