import type { Id } from '$convex/_generated/dataModel';
import type { QueryCtx } from '$convex/_generated/server';
import { ShardedCounter } from '$convex/counter/client';
import { components } from '../_generated/api';

type Counters =
	| 'participants'
	| 'absent'
	| 'banned'
	| `voters:${Id<'polls'>}`
	| `votes:${Id<'polls'>}`
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

export function getVotersCounter(meetingId: Id<'meetings'>, pollId: Id<'polls'>) {
	return counter.for(meetingId, `voters:${pollId}`);
}

export function getVotesCounter(meetingId: Id<'meetings'>, pollId: Id<'polls'>) {
	return counter.for(meetingId, `votes:${pollId}`);
}

export function getAllCounters(meetingId: Id<'meetings'>) {
	return {
		all: (ctx: QueryCtx) => counter.for(meetingId, undefined).countAll(ctx),
		participants: getParticipantCounter(meetingId),
		absent: getAbsentCounter(meetingId),
		banned: getBannedCounter(meetingId),
		voters: (pollId: Id<'polls'>) => getVotersCounter(meetingId, pollId),
		votes: (pollId: Id<'polls'>) => getVotesCounter(meetingId, pollId),
	};
}
