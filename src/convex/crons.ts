import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
	'meeting snapshots open meetings',
	{ minutes: 15 },
	internal.meeting.jobs.snapshots.runOpenMeetingSnapshots,
	{},
);

export default crons;
