import type { Id } from '$convex/_generated/dataModel';
import type { QueryCtx } from '$convex/_generated/server';
import { ShardedCounter } from '$convex/counter/client';
import { components } from '../_generated/api';

type Counters =
	| 'participants'
	| 'absent'
	| 'banned'
	| `voters:${Id<'meetingPolls'>}`
	| `votes:${Id<'meetingPolls'>}`
	| `user_poll_voters:${Id<'userPolls'>}`
	| `user_poll_votes:${Id<'userPolls'>}`
	| undefined;

const counter = new ShardedCounter<string, Counters>(components.counters);

export function getParticipantCounter(meetingId: Id<'meetings'>) {
	return counter.for(meetingId, `participants`);
}

export function getAbsentCounter(meetingId: Id<'meetings'>) {
	return counter.for(meetingId, `absent`);
}

export function getBannedCounter(meetingId: Id<'meetings'>) {
	return counter.for(meetingId, `banned`);
}

export function getVotersCounter(meetingId: Id<'meetings'>, pollId: Id<'meetingPolls'>) {
	return counter.for(meetingId, `voters:${pollId}`);
}

export function getVotesCounter(meetingId: Id<'meetings'>, pollId: Id<'meetingPolls'>) {
	return counter.for(meetingId, `votes:${pollId}`);
}

export function getUserPollVotersCounter(pollId: Id<'userPolls'>) {
	return counter.for(`user_poll:${pollId}`, `user_poll_voters:${pollId}`);
}

export function getUserPollVotesCounter(pollId: Id<'userPolls'>) {
	return counter.for(`user_poll:${pollId}`, `user_poll_votes:${pollId}`);
}

export function getAllCounters(meetingId: Id<'meetings'>) {
	return {
		all: (ctx: QueryCtx) => counter.for(meetingId, undefined).countAll(ctx),
		participants: getParticipantCounter(meetingId),
		absent: getAbsentCounter(meetingId),
		banned: getBannedCounter(meetingId),
		voters: (pollId: Id<'meetingPolls'>) => getVotersCounter(meetingId, pollId),
		votes: (pollId: Id<'meetingPolls'>) => getVotesCounter(meetingId, pollId),
	};
}
