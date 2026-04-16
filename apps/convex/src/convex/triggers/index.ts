import type { DataModel } from '@lsnd/convex/_generated/dataModel';
import { Triggers } from 'convex-helpers/server/triggers';
import { registerMeetingSimplifiedSnapshotTriggers } from './meeting';

const triggers = new Triggers<DataModel>();

registerMeetingSimplifiedSnapshotTriggers(triggers);

export { triggers };
