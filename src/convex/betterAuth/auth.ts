import type { DataModel } from '$convex/_generated/dataModel';
import type { GenericCtx } from '@convex-dev/better-auth';
import { createAuth } from '../auth';

// Export a static instance for Better Auth schema generation
export const auth = createAuth({} as GenericCtx<DataModel>);
