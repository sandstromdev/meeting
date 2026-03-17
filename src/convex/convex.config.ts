import { defineApp } from 'convex/server';
import betterAuth from './betterAuth/convex.config';
import counter from '@convex-dev/sharded-counter/convex.config';
import counters from './counter/convex.config';

const app = defineApp();

app.use(betterAuth);
app.use(counter);
app.use(counters);

export default app;
