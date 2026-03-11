import type { MutationCtx, QueryCtx } from '$convex/_generated/server';

export type QueryDb = Pick<QueryCtx, 'db'>['db'];
export type MutationDb = Pick<MutationCtx, 'db'>['db'];

export type Db = QueryDb | MutationDb;
