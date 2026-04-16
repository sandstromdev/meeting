import type { MutationCtx, QueryCtx } from '@lsnd/convex/_generated/server';

export type QueryDb = Pick<QueryCtx, 'db'>['db'];
export type MutationDb = Pick<MutationCtx, 'db'>['db'];

export type Db = QueryDb | MutationDb;

export type Direction = 'up' | 'down' | 'in' | 'out';
