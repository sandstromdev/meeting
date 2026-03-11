import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx } from '$convex/_generated/server';
import type { MajorityRule, PollType } from '$lib/polls';
import { AppError, errors } from './error';
import type { Db } from './types';

/** Label for the abstain option when allowsAbstain is true. */
export const ABSTAIN_OPTION_LABEL = 'Avstår';

export function optionsWithAbstainIfRequested(options: string[], allowsAbstain: boolean) {
	if (allowsAbstain) {
		if (options[options.length - 1] === ABSTAIN_OPTION_LABEL) {
			return options;
		}
		return [...options, ABSTAIN_OPTION_LABEL];
	}
	if (options[options.length - 1] === ABSTAIN_OPTION_LABEL) {
		return options.slice(0, -1);
	}
	return options;
}

function getMajorityThreshold(rule: MajorityRule) {
	switch (rule) {
		case 'simple':
			return 0.5;
		case 'two_thirds':
			return 2 / 3;
		case 'three_quarters':
			return 0.75;
		case 'unanimous':
			return 1;
	}
}

export type OptionTotal = { optionIndex: number; option: string; votes: number };

export function computeWinners(
	poll: Doc<'polls'>,
	optionTotals: OptionTotal[],
	votesCast: number,
): { winnerOptionIndexes: number[]; isTie: boolean } {
	if (optionTotals.length === 0 || votesCast === 0) {
		return { winnerOptionIndexes: [], isTie: false };
	}
	if (poll.type === 'multi_winner') {
		const count = Math.max(1, Math.min(poll.winningCount, optionTotals.length));
		const sorted = [...optionTotals].toSorted((a, b) => b.votes - a.votes);
		const thresholdVotes = sorted[count - 1]?.votes ?? 0;
		const winners = sorted.filter((o) => o.votes >= thresholdVotes).map((o) => o.optionIndex);
		const lastWinnerVotes = sorted[count - 1]?.votes;
		const isTie =
			lastWinnerVotes != null && sorted.filter((o) => o.votes === lastWinnerVotes).length > 1;
		return { winnerOptionIndexes: winners, isTie };
	}
	// single_winner: option(s) that meet majority of votes cast
	const rule = poll.majorityRule;
	const threshold = getMajorityThreshold(rule);
	const minVotes =
		rule === 'simple'
			? Math.floor(votesCast * threshold) + 1 // strictly more than half
			: Math.ceil(votesCast * threshold);
	const meeting = optionTotals.filter((o) => o.votes >= minVotes);
	const sorted = [...meeting].toSorted((a, b) => b.votes - a.votes);
	const topVotes = sorted[0]?.votes;
	if (topVotes == null) {
		return { winnerOptionIndexes: [], isTie: false };
	}
	const winners = sorted.filter((o) => o.votes === topVotes).map((o) => o.optionIndex);
	return {
		winnerOptionIndexes: winners,
		isTie: winners.length > 1,
	};
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

export function assertPollVoteLimit(options: string[], maxVotesPerVoter: number) {
	if (maxVotesPerVoter < 1 || maxVotesPerVoter > options.length) {
		throw new AppError(
			errors.invalid_poll_vote_limit({
				maxVotesPerVoter,
				optionsCount: options.length,
			}),
		);
	}
}

/* export function getPollMaxVotesPerVoter(poll: Doc<'polls'>) {
	if (poll.type === 'single_winner') {
		return 1;
	}
	const configured = Math.floor(poll.maxVotesPerVoter);
	return Math.max(1, Math.min(configured, poll.options.length));
} */

export function assertPollTypeConfig(
	pollType: PollType,
	optionsCount: number,
	opts: { winningCount?: number; majorityRule?: MajorityRule },
) {
	if (pollType === 'multi_winner') {
		const count = opts.winningCount ?? 1;
		if (count < 1 || count > optionsCount) {
			throw new AppError(
				errors.invalid_poll_type_config({ kind: 'winningCount', value: count, optionsCount }),
			);
		}
	} else {
		if (!opts.majorityRule) {
			throw new AppError(errors.invalid_poll_type_config({ kind: 'majorityRule_required' }));
		}
	}
}
