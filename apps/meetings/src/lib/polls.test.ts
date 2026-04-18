import { describe, expect, it } from 'vitest';

import type { PollOptionTotal } from './pollOptionTotal';
import {
	getEligibleVotes,
	getMajorityRuleThreshold,
	getVoteShare,
	meetsMajorityThreshold,
	minimumVotesForMajority,
	newPollDraft,
	trimmedPollOptionTitles,
} from './polls';

describe('polls majority helpers', () => {
	it('getMajorityRuleThreshold returns expected ratios', () => {
		expect(getMajorityRuleThreshold('simple')).toBe(0.5);
		expect(getMajorityRuleThreshold('two_thirds')).toBeCloseTo(2 / 3);
		expect(getMajorityRuleThreshold('three_quarters')).toBe(0.75);
		expect(getMajorityRuleThreshold('unanimous')).toBe(1);
	});

	it('meetsMajorityThreshold uses floor+1 for simple majority', () => {
		// 5 voters, >50% means at least 3
		expect(meetsMajorityThreshold('simple', 2, 5)).toBe(false);
		expect(meetsMajorityThreshold('simple', 3, 5)).toBe(true);
	});

	it('meetsMajorityThreshold uses ceil for qualified majorities', () => {
		expect(meetsMajorityThreshold('two_thirds', 6, 9)).toBe(true);
		expect(meetsMajorityThreshold('two_thirds', 5, 9)).toBe(false);
	});

	it('minimumVotesForMajority matches meetsMajorityThreshold boundary', () => {
		const rule = 'simple' as const;
		const maxVotes = 7;
		const min = minimumVotesForMajority(rule, maxVotes);
		expect(meetsMajorityThreshold(rule, min - 1, maxVotes)).toBe(false);
		expect(meetsMajorityThreshold(rule, min, maxVotes)).toBe(true);
	});
});

describe('polls formatting helpers', () => {
	it('getVoteShare handles zero total', () => {
		expect(getVoteShare(3, 0)).toBe('0.0');
	});

	it('getVoteShare formats one decimal', () => {
		expect(getVoteShare(1, 3)).toBe('33.3');
	});

	it('getEligibleVotes filters abstain when enabled', () => {
		const totals: PollOptionTotal[] = [
			{ optionIndex: 0, option: 'Ja', votes: 1 },
			{ optionIndex: 1, option: 'Avstår', votes: 2 },
		];
		expect(getEligibleVotes(totals, true).map((o) => o.option)).toEqual(['Ja']);
		expect(getEligibleVotes(totals, false)).toEqual(totals);
	});

	it('trimmedPollOptionTitles drops blanks', () => {
		const draft = newPollDraft();
		draft.options = [
			{ title: '  A ', description: null },
			{ title: '', description: null },
			{ title: 'B', description: null },
		];
		expect(trimmedPollOptionTitles(draft)).toEqual(['A', 'B']);
	});
});
