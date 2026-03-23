import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';

import schema from './schema';
import { modules } from './test.setup';

describe('convex ci smoke', () => {
	it('initializes convex-test and runs a simple transaction', async () => {
		const t = convexTest(schema, modules);
		const value = await t.run(async () => 'ok');
		expect(value).toBe('ok');
	});
});
