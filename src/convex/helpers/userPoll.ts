import type { Doc, Id } from '$convex/_generated/dataModel';
import type { Auth } from 'convex/server';
import { stripSystemFields } from '.';
import { AppError, appErrors } from './error';
import type { Db } from './types';
import type { MajorityRule } from './schema';

export type UserPollOptionTotal = { optionIndex: number; option: string; votes: number };

type UserPollResultSnapshotData = Omit<Doc<'userPollResults'>, '_id' | '_creationTime'>;
type UserPollResultSnapshotArgs = {
	poll: Doc<'userPolls'>;
	complete: boolean;
	results: {
		optionTotals: UserPollOptionTotal[];
		winners: UserPollOptionTotal[];
		isTie: boolean;
		majorityRule: MajorityRule | null;
		counts: {
			totalVotes: number;
			usableVotes: number;
			abstain: number;
		};
	};
};

export function buildUserPollResultSnapshot(
	args: UserPollResultSnapshotArgs,
): UserPollResultSnapshotData {
	const { poll, complete, results } = args;

	return {
		pollId: poll._id,
		closedAt: poll.closedAt ?? Date.now(),
		poll: stripSystemFields(poll),
		complete,
		results,
	};
}

export async function getUserPollOrThrow(db: Db, pollId?: Id<'userPolls'>) {
	AppError.assertNotNull(pollId, appErrors.bad_request({ pollId }));

	const poll = await db.get('userPolls', pollId);
	AppError.assertNotNull(poll, appErrors.user_poll_not_found(pollId));
	return poll;
}

export function assertUserPollEditable(poll: Pick<Doc<'userPolls'>, 'isOpen'>) {
	AppError.assert(!poll.isOpen, appErrors.illegal_user_poll_action('edit_while_open'));
}

export function assertUserPollOwner(poll: Pick<Doc<'userPolls'>, 'ownerUserId'>, userId: string) {
	AppError.assert(poll.ownerUserId === userId, appErrors.forbidden());
}

export async function getLatestUserPollResultSnapshot(db: Db, pollId: Id<'userPolls'>) {
	return await db
		.query('userPollResults')
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

	AppError.assertNotNull(token, appErrors.illegal_user_poll_action('missing_session_key'));

	return formatVoterKey(pollVisibilityMode, token);
}

export async function formatVoterKey(
	pollVisibilityMode: 'public' | 'account_required',
	idToken?: string,
) {
	const digest = await crypto.subtle.digest('sha-256', new TextEncoder().encode(idToken));
	const hashed = Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	if (pollVisibilityMode === 'account_required') {
		AppError.assertNotNull(idToken, appErrors.illegal_user_poll_action('auth_required'));
		return `user:${hashed}`;
	}

	AppError.assert(idToken != null, appErrors.illegal_user_poll_action('missing_session_key'));
	return `session:${hashed}`;
}
