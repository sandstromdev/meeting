import type { DataModel } from '$convex/_generated/dataModel';
import { Triggers } from 'convex-helpers/server/triggers';
import { registerMeetingSimplifiedSnapshotTriggers } from './meeting';

const triggers = new Triggers<DataModel>();

registerMeetingSimplifiedSnapshotTriggers(triggers);

export { triggers };
