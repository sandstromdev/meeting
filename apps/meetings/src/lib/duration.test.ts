import { describe, expect, it } from 'vitest';

import { formatDuration, formatDurationMs, splitDuration } from './duration';

describe('duration', () => {
	it('formatDurationMs handles undefined and clamps negatives', () => {
		expect(formatDurationMs(undefined)).toBe('00:00');
		expect(formatDurationMs(-1000)).toBe('00:00');
	});

	it('formatDurationMs formats mm:ss and hh:mm:ss', () => {
		expect(formatDurationMs(65_000)).toBe('01:05');
		expect(formatDurationMs(3_661_000)).toBe('01:01:01');
	});

	it('splitDuration extracts parts', () => {
		const ms = 3_661_000;
		expect(splitDuration(ms)).toEqual({ hours: 1, minutes: 1, seconds: 1 });
		expect(splitDuration(ms, { hours: false, minutes: true, seconds: true })).toEqual({
			minutes: 1,
			seconds: 1,
		});
	});

	it('formatDuration formats from milliseconds via Intl', () => {
		const s = formatDuration(90_000);
		expect(typeof s).toBe('string');
		expect(s.length).toBeGreaterThan(0);
	});
});
