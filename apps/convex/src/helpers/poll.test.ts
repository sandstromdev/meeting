import { describe, expect, it } from 'vitest';

import type { PollOptionTotal } from './poll';
import { computePollOutcome } from './poll';

function totals(rows: Array<{ option: string; votes: number }>): PollOptionTotal[] {
	return rows.map((r, optionIndex) => ({
		optionIndex,
		option: r.option,
		description: null,
		votes: r.votes,
	}));
}

/** Descending by votes (how `rankOptionsForScoring` orders before outcome). */
function rankedDescending(rows: Array<{ option: string; votes: number }>): PollOptionTotal[] {
	const t = totals(rows);
	return t.toSorted((a, b) => b.votes - a.votes || a.optionIndex - b.optionIndex);
}

function* voteCountTuples(length: number, max: number): Generator<number[]> {
	if (length === 0) {
		yield [];
		return;
	}
	for (const prefix of voteCountTuples(length - 1, max)) {
		for (let v = 0; v <= max; v++) {
			yield [...prefix, v];
		}
	}
}

describe('computePollOutcome', () => {
	describe('single_winner', () => {
		it('throws when majorityRule is missing', () => {
			expect(() =>
				computePollOutcome({ type: 'single_winner' }, totals([{ option: 'A', votes: 1 }])),
			).toThrow(/single_winner poll missing majorityRule/);
		});

		describe('relative (plurality)', () => {
			it('picks the unique top vote getter', () => {
				const ranked = totals([
					{ option: 'A', votes: 4 },
					{ option: 'B', votes: 3 },
					{ option: 'C', votes: 2 },
				]);
				const { winners, isTie, majorityRule } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'relative' },
					ranked,
				);
				expect(winners.map((w) => w.option)).toEqual(['A']);
				expect(isTie).toBe(false);
				expect(majorityRule).toBe('relative');
			});

			it('returns all options tied for first place', () => {
				const ranked = totals([
					{ option: 'A', votes: 5 },
					{ option: 'B', votes: 5 },
					{ option: 'C', votes: 2 },
				]);
				const { winners, isTie } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'relative' },
					ranked,
				);
				expect(winners.map((w) => w.option).toSorted()).toEqual(['A', 'B']);
				expect(isTie).toBe(true);
			});

			it('has no winners when every option has zero votes', () => {
				const ranked = totals([
					{ option: 'A', votes: 0 },
					{ option: 'B', votes: 0 },
				]);
				const { winners, isTie } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'relative' },
					ranked,
				);
				expect(winners).toEqual([]);
				expect(isTie).toBe(false);
			});
		});

		describe('simple majority (>50% of usable votes)', () => {
			it('wins only when the leader clears the threshold', () => {
				const ranked = totals([
					{ option: 'A', votes: 6 },
					{ option: 'B', votes: 3 },
					{ option: 'C', votes: 2 },
				]);
				const { winners, isTie } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'simple' },
					ranked,
				);
				expect(winners.map((w) => w.option)).toEqual(['A']);
				expect(isTie).toBe(false);
			});

			it('has no winner when the leader is only a plurality', () => {
				const ranked = totals([
					{ option: 'A', votes: 4 },
					{ option: 'B', votes: 3 },
					{ option: 'C', votes: 2 },
				]);
				const { winners, isTie } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'simple' },
					ranked,
				);
				expect(winners).toEqual([]);
				expect(isTie).toBe(false);
			});

			it('has no winner on a two-way tie at 50%', () => {
				const ranked = totals([
					{ option: 'A', votes: 5 },
					{ option: 'B', votes: 5 },
				]);
				const { winners, isTie } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'simple' },
					ranked,
				);
				expect(winners).toEqual([]);
				expect(isTie).toBe(false);
			});

			it('never yields multiple winners or isTie (exhaustive small grids)', () => {
				const labels = ['A', 'B', 'C', 'D'] as const;
				const maxPerOption = 6;
				for (let n = 2; n <= labels.length; n++) {
					for (const counts of voteCountTuples(n, maxPerOption)) {
						const ranked = rankedDescending(
							counts.map((votes, i) => ({ option: labels[i], votes })),
						);
						const { winners, isTie } = computePollOutcome(
							{ type: 'single_winner', majorityRule: 'simple' },
							ranked,
						);
						expect(winners.length, `counts=${counts.join(',')}`).toBeLessThanOrEqual(1);
						expect(isTie, `counts=${counts.join(',')}`).toBe(false);
					}
				}
			});
		});

		describe('qualified majorities', () => {
			it('two_thirds: requires ceil(2/3 * total) on the leader', () => {
				const ranked = totals([
					{ option: 'A', votes: 7 },
					{ option: 'B', votes: 3 },
				]);
				const ok = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'two_thirds' },
					ranked,
				);
				expect(ok.winners.map((w) => w.option)).toEqual(['A']);

				const short = totals([
					{ option: 'A', votes: 6 },
					{ option: 'B', votes: 4 },
				]);
				const none = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'two_thirds' },
					short,
				);
				expect(none.winners).toEqual([]);
			});

			it('three_quarters: requires ceil(3/4 * total) on the leader', () => {
				const ranked = totals([
					{ option: 'A', votes: 8 },
					{ option: 'B', votes: 2 },
				]);
				const { winners } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'three_quarters' },
					ranked,
				);
				expect(winners.map((w) => w.option)).toEqual(['A']);

				const short = totals([
					{ option: 'A', votes: 7 },
					{ option: 'B', votes: 3 },
				]);
				expect(
					computePollOutcome({ type: 'single_winner', majorityRule: 'three_quarters' }, short)
						.winners,
				).toEqual([]);
			});

			it('unanimous: only wins when the leader has every vote', () => {
				const ranked = totals([
					{ option: 'A', votes: 5 },
					{ option: 'B', votes: 0 },
				]);
				const { winners } = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'unanimous' },
					ranked,
				);
				expect(winners.map((w) => w.option)).toEqual(['A']);

				const split = totals([
					{ option: 'A', votes: 4 },
					{ option: 'B', votes: 1 },
				]);
				const none = computePollOutcome(
					{ type: 'single_winner', majorityRule: 'unanimous' },
					split,
				);
				expect(none.winners).toEqual([]);
			});
		});
	});

	describe('multi_winner', () => {
		it('with winningCount 1 matches relative plurality', () => {
			const ranked = totals([
				{ option: 'A', votes: 4 },
				{ option: 'B', votes: 3 },
				{ option: 'C', votes: 2 },
			]);
			const multi = computePollOutcome({ type: 'multi_winner', winningCount: 1 }, ranked);
			const rel = computePollOutcome({ type: 'single_winner', majorityRule: 'relative' }, ranked);
			expect(multi.winners.map((w) => w.option)).toEqual(rel.winners.map((w) => w.option));
			expect(multi.isTie).toBe(rel.isTie);
			expect(multi.majorityRule).toBe(null);
		});

		it('includes everyone at or above the K-th place score (ties expand the set)', () => {
			const ranked = totals([
				{ option: 'A', votes: 10 },
				{ option: 'B', votes: 8 },
				{ option: 'C', votes: 8 },
				{ option: 'D', votes: 3 },
			]);
			const { winners, isTie } = computePollOutcome(
				{ type: 'multi_winner', winningCount: 2 },
				ranked,
			);
			expect(winners.map((w) => w.option).toSorted()).toEqual(['A', 'B', 'C']);
			expect(isTie).toBe(true);
		});

		it('defaults winningCount to 1 when omitted', () => {
			const ranked = totals([
				{ option: 'A', votes: 2 },
				{ option: 'B', votes: 1 },
			]);
			const { winners } = computePollOutcome({ type: 'multi_winner' }, ranked);
			expect(winners.map((w) => w.option)).toEqual(['A']);
		});
	});
});
