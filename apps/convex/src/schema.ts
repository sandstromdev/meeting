import { defineSchema } from 'convex/server';

import { meetingPollTables } from './schema/meetingPolls';
import { meetingTables } from './schema/meetings';
import { userPollTables } from './schema/userPolls';

export default defineSchema(
	{
		...meetingTables,
		...meetingPollTables,
		...userPollTables,
	},
	{ schemaValidation: false },
);
