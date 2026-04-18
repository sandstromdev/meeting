import { describe, expect, it } from 'vitest';

import { getAppError } from './error';
import { assertMeetingNotArchived } from './meetingLifecycle';

describe('meetingLifecycle', () => {
	it('does nothing when meeting is not archived', () => {
		expect(() =>
			assertMeetingNotArchived({
				_id: 'm1' as never,
				code: '123456',
				status: 'scheduled',
			} as never),
		).not.toThrow();
	});

	it('throws meeting_archived using override meeting code when provided', () => {
		try {
			assertMeetingNotArchived(
				{
					_id: 'm1' as never,
					code: '123456',
					status: 'archived',
				} as never,
				{ meetingCode: '999999' },
			);
			expect.fail('expected throw');
		} catch (e) {
			const appErr = getAppError(e);
			expect(appErr?.is('meeting_archived')).toBe(true);
			expect(appErr?.toJSON().error).toMatchObject({
				meetingId: 'm1',
				meetingCode: '999999',
			});
		}
	});

	it('throws meeting_archived using meeting.code when no override', () => {
		try {
			assertMeetingNotArchived({
				_id: 'm2' as never,
				code: '654321',
				status: 'archived',
			} as never);
			expect.fail('expected throw');
		} catch (e) {
			const appErr = getAppError(e);
			expect(appErr?.toJSON().error).toMatchObject({
				meetingId: 'm2',
				meetingCode: '654321',
			});
		}
	});
});
