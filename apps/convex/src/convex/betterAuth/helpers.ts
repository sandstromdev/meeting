import { createBuilder } from '@lsnd/convex/helpers/builder';
import { Triggers } from 'convex-helpers/server/triggers';
import type { DataModel } from './_generated/dataModel';

const triggers = new Triggers<DataModel>();

export const c = createBuilder<DataModel>(triggers);
