import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from './error';

type Db = QueryCtx['db'];

/** Label for the abstain option when allowsAbstain is true. */
export const ABSTAIN_OPTION_LABEL = 'Avstår';

export function optionsWithAbstainIfRequested(
	options: string[],
	allowsAbstain: boolean,
): string[] {
	if (allowsAbstain) {
		if (options[options.length - 1] === ABSTAIN_OPTION_LABEL) return options;
		return [...options, ABSTAIN_OPTION_LABEL];
	}
	if (options[options.length - 1] === ABSTAIN_OPTION_LABEL) return options.slice(0, -1);
	return options;
}

export type PollType = 'multi_winner' | 'single_winner';
export type MajorityRule = 'simple' | 'two_thirds' | 'three_quarters' | 'unanimous';

export function getPollType(poll: Pick<Doc<'polls'>, 'type' | 'winningCount' | 'majorityRule'>): PollType {
	return poll.type ?? 'single_winner';
}

function getMajorityThreshold(rule: MajorityRule): number {
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
	poll: Pick<Doc<'polls'>, 'type' | 'winningCount' | 'majorityRule' | 'options'>,
	optionTotals: OptionTotal[],
	votesCast: number,
): { winnerOptionIndexes: number[]; isTie: boolean } {
	const type = getPollType(poll);
	if (optionTotals.length === 0 || votesCast === 0) {
		return { winnerOptionIndexes: [], isTie: false };
	}
	if (type === 'multi_winner') {
		const count = Math.max(1, Math.min(poll.winningCount ?? 1, optionTotals.length));
		const sorted = [...optionTotals].sort((a, b) => b.votes - a.votes);
		const thresholdVotes = sorted[count - 1]?.votes ?? 0;
		const winners = sorted
			.filter((o) => o.votes >= thresholdVotes)
			.map((o) => o.optionIndex);
		const lastWinnerVotes = sorted[count - 1]?.votes;
		const isTie = lastWinnerVotes != null && sorted.filter((o) => o.votes === lastWinnerVotes).length > 1;
		return { winnerOptionIndexes: winners, isTie };
	}
	// single_winner: option(s) that meet majority of votes cast
	const rule = poll.majorityRule ?? 'simple';
	const threshold = getMajorityThreshold(rule);
	const minVotes =
		rule === 'simple'
			? Math.floor(votesCast * threshold) + 1 // strictly more than half
			: Math.ceil(votesCast * threshold);
	const meeting = optionTotals.filter((o) => o.votes >= minVotes);
	const sorted = [...meeting].sort((a, b) => b.votes - a.votes);
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

export function assertPollOptionIndex(poll: Pick<Doc<'polls'>, 'options'>, optionIndex: number) {
	if (optionIndex < 0 || optionIndex >= poll.options.length) {
		throw new AppError(errors.invalid_poll_option(optionIndex));
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

export function getPollMaxVotesPerVoter(
	poll: Pick<Doc<'polls'>, 'options' | 'maxVotesPerVoter' | 'type'>,
): number {
	if (getPollType(poll) === 'single_winner') {
		return 1;
	}
	const configured = Math.floor(poll.maxVotesPerVoter ?? 1);
	return Math.max(1, Math.min(configured, poll.options.length));
}

export function assertPollTypeConfig(
	pollType: PollType,
	optionsCount: number,
	opts: { winningCount?: number; majorityRule?: MajorityRule },
) {
	if (pollType === 'multi_winner') {
		const count = opts.winningCount ?? 1;
		if (count < 1 || count > optionsCount) {
			throw new AppError(errors.invalid_poll_type_config({ kind: 'winningCount', value: count, optionsCount }));
		}
	} else {
		if (!opts.majorityRule) {
			throw new AppError(errors.invalid_poll_type_config({ kind: 'majorityRule_required' }));
		}
	}
}

export function getEligibleVoterCount(meeting: Pick<Doc<'meetings'>, 'participants' | 'absent'>) {
	return Math.max(0, (meeting.participants ?? 0) - (meeting.absent ?? 0));
}

export async function countVotesForPoll(db: Db, pollId: Id<'polls'>) {
	const votes = await db
		.query('pollVotes')
		.withIndex('by_poll', (q) => q.eq('pollId', pollId))
		.collect();
	return votes.length;
}

export async function countVotersForPoll(db: Db, pollId: Id<'polls'>) {
	const votes = await db
		.query('pollVotes')
		.withIndex('by_poll', (q) => q.eq('pollId', pollId))
		.collect();
	return new Set(votes.map((vote) => vote.anonID)).size;
}

export async function getVoteByAnonId(db: Db, pollId: Id<'polls'>, anonID: number) {
	return db
		.query('pollVotes')
		.withIndex('by_poll_anon', (q) => q.eq('pollId', pollId).eq('anonID', anonID))
		.first();
}

export async function closePoll(
	db: MutationCtx['db'],
	pollId: Id<'polls'>,
	opts?: { closedBy?: Id<'meetingParticipants'> },
) {
	await db.patch('polls', pollId, {
		isOpen: false,
		closedAt: Date.now(),
		closedBy: opts?.closedBy,
		updatedAt: Date.now(),
	});
}

export async function closePollIfAllEligibleHaveVoted(
	db: MutationCtx['db'],
	meeting: Pick<Doc<'meetings'>, 'participants' | 'absent'>,
	pollId: Id<'polls'>,
) {
	const eligibleVoters = getEligibleVoterCount(meeting);
	const votersCount = await countVotersForPoll(db, pollId);

	if (eligibleVoters > 0 && votersCount >= eligibleVoters) {
		await closePoll(db, pollId);
		return true;
	}

	return false;
}
