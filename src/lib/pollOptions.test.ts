import { describe, expect, it } from 'vitest';
import { ABSTAIN_OPTION_LABEL } from './pollConstants';
import {
	draftOptionsFromStored,
	normalizeStoredPollOptions,
	optionsWithAbstainLastRows,
} from './pollOptions';

describe('pollOptions', () => {
	it('normalizes legacy string options', () => {
		expect(normalizeStoredPollOptions(['Ja', 'Nej'])).toEqual([
			{ title: 'Ja', description: null },
			{ title: 'Nej', description: null },
		]);
	});

	it('normalizes row objects and empty descriptions', () => {
		expect(
			normalizeStoredPollOptions([
				{ title: 'A', description: '' },
				{ title: 'B', description: '  x ' },
			]),
		).toEqual([
			{ title: 'A', description: null },
			{ title: 'B', description: 'x' },
		]);
	});

	it('strips trailing abstain row for draft', () => {
		const stored = [
			{ title: 'Ja', description: null },
			{ title: ABSTAIN_OPTION_LABEL, description: null },
		];
		expect(draftOptionsFromStored(stored, true)).toEqual([{ title: 'Ja', description: null }]);
	});

	it('appends abstain row', () => {
		expect(optionsWithAbstainLastRows([{ title: 'Ja', description: null }], true)).toEqual([
			{ title: 'Ja', description: null },
			{ title: ABSTAIN_OPTION_LABEL, description: null },
		]);
	});
});
