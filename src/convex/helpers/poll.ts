import type { Doc, Id } from '$convex/_generated/dataModel';
import { ABSTAIN_OPTION_LABEL } from '$lib/polls';
import type { StripSystemFields } from '$lib/types';
import { stripSystemFields } from '.';
import { AppError, errors } from './error';
import type { Db } from './types';

export type OptionTotal = { optionIndex: number; option: string; votes: number };

type PollResultSnapshotData = StripSystemFields<Doc<'pollResults'>>;
type PollResultSnapshotArgs = {
	poll: Doc<'polls'>;
	complete: boolean;
	results: {
		optionTotals: OptionTotal[];
		winners: OptionTotal[];
		isTie: boolean;
		majorityRule?: Doc<'pollResults'>['results']['majorityRule'];
		counts: {
			totalVotes: number;
			eligibleVoters: number;
			usableVotes: number;
			abstain: number;
		};
	};
};

export function buildPollResultSnapshot(args: PollResultSnapshotArgs): PollResultSnapshotData {
	const { poll, complete, results } = args;

	return {
		meetingId: poll.meetingId,
		pollId: poll._id,
		closedAt: poll.closedAt ?? Date.now(),
		poll: stripSystemFields(poll),
		complete,
		results,
	} satisfies PollResultSnapshotData;
}

export async function getPollOrThrow(db: Db, pollId?: Id<'polls'>) {
	AppError.assertNotNull(pollId, errors.invalid_args({ pollId }));

	const poll = await db.get('polls', pollId);

	AppError.assertNotNull(poll, errors.poll_not_found(pollId));

	return poll;
}

export async function getLatestPollResultSnapshot(db: Db, pollId: Id<'polls'>) {
	return db
		.query('pollResults')
		.withIndex('by_poll_and_closedAt', (q) => q.eq('pollId', pollId))
		.order('desc')
		.first();
}

export function assertPollInMeeting(
	poll: Pick<Doc<'polls'>, '_id' | 'meetingId'>,
	meetingId: Id<'meetings'>,
) {
	AppError.assert(poll.meetingId === meetingId, errors.poll_not_found(poll._id));
}

export function assertPollEditable(poll: Pick<Doc<'polls'>, 'isOpen'>) {
	AppError.assert(!poll.isOpen, errors.illegal_poll_action('edit_while_open'));
}
export function stripAbstain(optionTotals: OptionTotal[], allowsAbstain: boolean) {
	return allowsAbstain
		? optionTotals.filter((o) => o.option !== ABSTAIN_OPTION_LABEL)
		: optionTotals;
}
