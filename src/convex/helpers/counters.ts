import type { Id } from '$convex/_generated/dataModel';
import { ShardedCounter } from '@convex-dev/sharded-counter';
import { components } from '../_generated/api';

const absentCounter = new ShardedCounter<Id<'meetings'>>(components.absentCounter);
const participantCounter = new ShardedCounter<Id<'meetings'>>(components.participantCounter);

export function getParticipantCounter(meetingId: Id<'meetings'>) {
	return participantCounter.for(meetingId);
}

export function getAbsentCounter(meetingId: Id<'meetings'>) {
	return absentCounter.for(meetingId);
}
