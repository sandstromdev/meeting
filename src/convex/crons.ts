import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('prune stale heartbeats', { minutes: 15 }, internal.heartbeat.pruneStaleHeartbeats);

crons.interval(
	'meeting snapshots open meetings',
	{ minutes: 15 },
	internal.backup.runOpenMeetingSnapshots,
	{},
);

export default crons;
