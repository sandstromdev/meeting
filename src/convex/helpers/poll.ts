import type { Doc, Id } from '$convex/_generated/dataModel';
import { minimumVotesForMajority } from '$lib/polls';
import { AppError, errors } from './error';
import type { Db } from './types';

export type OptionTotal = { optionIndex: number; option: string; votes: number };

export function computeWinners(
	poll: Doc<'polls'>,
	optionTotals: OptionTotal[],
	votesCast: number,
	maxVotes: number,
): { winnerOptionIndexes: number[]; isTie: boolean } {
	if (optionTotals.length === 0 || votesCast === 0) {
		return { winnerOptionIndexes: [], isTie: false };
	}

	if (poll.type === 'multi_winner') {
		return computeMultiWinnerPoll(poll, optionTotals);
	}

	return computeSingleWinnerPoll(poll, optionTotals, votesCast, maxVotes);
}

function computeSingleWinnerPoll(
	poll: Doc<'polls'> & { type: 'single_winner' },
	optionTotals: OptionTotal[],
	votesCast: number,
	maxVotes: number,
) {
	const minVotes = minimumVotesForMajority(poll.majorityRule, maxVotes);

	const optionsMeetingThreshold = optionTotals.filter((o) => o.votes >= minVotes);
	const sorted = [...optionsMeetingThreshold].toSorted((a, b) => b.votes - a.votes);
	const topVotes = sorted[0]?.votes;

	if (topVotes == null) {
		return { winnerOptionIndexes: [], isTie: false };
	}

	const winners = sorted.filter((o) => o.votes === topVotes).map((o) => o.optionIndex);

	return { winnerOptionIndexes: winners, isTie: winners.length > 1 };
}

function computeMultiWinnerPoll(
	poll: Doc<'polls'> & { type: 'multi_winner' },
	optionTotals: OptionTotal[],
) {
	const winnerCount = Math.max(1, Math.min(poll.winningCount, optionTotals.length));

	const sorted = [...optionTotals].toSorted((a, b) => b.votes - a.votes);

	const thresholdVotes = sorted[winnerCount - 1]?.votes ?? 0;

	const winners = sorted.filter((o) => o.votes >= thresholdVotes).map((o) => o.optionIndex);

	const lastWinnerVotes = sorted[winnerCount - 1]?.votes;

	const isTie =
		lastWinnerVotes != null && sorted.filter((o) => o.votes === lastWinnerVotes).length > 1;

	return { winnerOptionIndexes: winners, isTie };
}

export async function getPollOrThrow(db: Db, pollId: Id<'polls'>) {
	const poll = await db.get('polls', pollId);
	if (!poll) {
		throw new AppError(errors.poll_not_found(pollId));
	}
	return poll;
}

export function assertPollInMeeting(
	poll: Pick<Doc<'polls'>, '_id' | 'meetingId'>,
	meetingId: Id<'meetings'>,
) {
	if (poll.meetingId !== meetingId) {
		throw new AppError(errors.poll_not_found(poll._id));
	}
}

export function assertPollEditable(poll: Pick<Doc<'polls'>, 'isOpen'>) {
	if (poll.isOpen) {
		throw new AppError(errors.illegal_poll_action('edit_while_open'));
	}
}
