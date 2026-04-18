import { describe, expect, it } from 'vitest';

import { checksumPayload, stableStringify } from './snapshotChecksum';

describe('snapshotChecksum', () => {
	it('stableStringify sorts object keys for deterministic output', () => {
		const a = stableStringify({ z: 1, a: 2, m: { b: 1, a: 2 } });
		const b = stableStringify({ m: { a: 2, b: 1 }, a: 2, z: 1 });
		expect(a).toBe(b);
	});

	it('stableStringify handles arrays, primitives, and null', () => {
		expect(stableStringify(null)).toBe('null');
		expect(stableStringify([3, { b: 1, a: 2 }])).toBe(
			`[${JSON.stringify(3)},${stableStringify({ b: 1, a: 2 })}]`,
		);
	});

	it('checksumPayload is stable for equivalent object key order', async () => {
		const h1 = await checksumPayload({ x: 1, y: 2 });
		const h2 = await checksumPayload({ y: 2, x: 1 });
		expect(h1).toBe(h2);
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
	});
});
