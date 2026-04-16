import { paginationOptsValidator as convexPaginationOptsValidator } from 'convex/server';
import { convexToZod } from 'convex-helpers/server/zod4';

export const paginationOptsValidator = convexToZod(convexPaginationOptsValidator);
