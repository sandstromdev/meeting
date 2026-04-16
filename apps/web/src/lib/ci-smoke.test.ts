import { describe, expect, it } from 'vitest';

describe('ci smoke', () => {
	it('runs app tests in node', () => {
		expect(1 + 1).toBe(2);
	});
});
