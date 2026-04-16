import migrations from '@convex-dev/migrations/convex.config.js';
import { defineApp } from 'convex/server';
import betterAuth from './betterAuth/convex.config';
import counters from './counter/convex.config';

const app = defineApp();

app.use(betterAuth);
app.use(counters);
app.use(migrations);

export default app;
