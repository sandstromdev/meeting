import type { DataModel } from '$convex/_generated/dataModel';
import { Triggers } from 'convex-helpers/server/triggers';

export const triggers = new Triggers<DataModel>();

triggers.register('meetings', async (ctx, change) => {
	console.log('meeting changed', change);
});
