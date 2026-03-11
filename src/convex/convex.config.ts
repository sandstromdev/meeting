import { defineApp } from 'convex/server';
import betterAuth from '@convex-dev/better-auth/convex.config';
import shardedCounter from '@convex-dev/sharded-counter/convex.config.js';

const app = defineApp();

app.use(betterAuth);
app.use(shardedCounter);

export default app;
