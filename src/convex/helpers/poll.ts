import type { Doc, Id } from '$convex/_generated/dataModel';
import type { MutationCtx, QueryCtx } from '$convex/_generated/server';
import { AppError, errors } from './error';

type Db = QueryCtx['db'];

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

export function getPollMaxVotesPerVoter(poll: Pick<Doc<'polls'>, 'options' | 'maxVotesPerVoter'>) {
	const configured = Math.floor(poll.maxVotesPerVoter ?? 1);
	return Math.max(1, Math.min(configured, poll.options.length));
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
