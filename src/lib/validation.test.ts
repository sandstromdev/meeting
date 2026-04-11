import { describe, expect, it } from 'vitest';

import { ABSTAIN_OPTION_LABEL } from './pollConstants';
import { MeetingCode, PollDraftOptionSchema, RefinePollDraftSchema } from './validation';

function validSingleWinnerDraft() {
	return {
		title: 'Val',
		options: [
			{ title: 'A', description: null },
			{ title: 'B', description: null },
		],
		type: 'single_winner' as const,
		winningCount: 1,
		majorityRule: 'simple' as const,
		isResultPublic: false,
		allowsAbstain: true,
		maxVotesPerVoter: 1,
	};
}

describe('MeetingCode', () => {
	it('accepts six digits', () => {
		expect(MeetingCode.parse('012345')).toBe('012345');
	});

	it('rejects non-numeric and wrong length', () => {
		expect(MeetingCode.safeParse('12345a').success).toBe(false);
		expect(MeetingCode.safeParse('12345').success).toBe(false);
	});
});

describe('PollDraftOptionSchema', () => {
	it('rejects titles that match the abstain label', () => {
		const r = PollDraftOptionSchema.safeParse({ title: ABSTAIN_OPTION_LABEL });
		expect(r.success).toBe(false);
	});

	it('normalizes blank descriptions to null', () => {
		const r = PollDraftOptionSchema.safeParse({ title: 'Ja', description: '  ' });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data).toEqual({ title: 'Ja', description: null });
		}
	});
});

describe('RefinePollDraftSchema', () => {
	it('accepts a minimal valid single_winner draft', () => {
		const r = RefinePollDraftSchema.safeParse(validSingleWinnerDraft());
		expect(r.success).toBe(true);
	});

	it('rejects duplicate option titles ignoring case', () => {
		const r = RefinePollDraftSchema.safeParse({
			...validSingleWinnerDraft(),
			options: [
				{ title: 'Ja', description: null },
				{ title: ' ja ', description: null },
			],
		});
		expect(r.success).toBe(false);
	});

	it('rejects maxVotesPerVoter above votable slots', () => {
		const r = RefinePollDraftSchema.safeParse({
			...validSingleWinnerDraft(),
			maxVotesPerVoter: 10,
		});
		expect(r.success).toBe(false);
	});

	it('requires two options when abstain is disabled', () => {
		const r = RefinePollDraftSchema.safeParse({
			...validSingleWinnerDraft(),
			options: [{ title: 'Only', description: null }],
			allowsAbstain: false,
		});
		expect(r.success).toBe(false);
	});
});
