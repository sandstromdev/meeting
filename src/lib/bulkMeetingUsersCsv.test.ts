import { describe, expect, it } from 'vitest';

import { BULK_MEETING_USER_IMPORT_LIMIT, parseBulkMeetingUsersCsv } from './bulkMeetingUsersCsv';

describe('parseBulkMeetingUsersCsv', () => {
	it('parses valid rows and normalizes email/password mode', () => {
		const rows = parseBulkMeetingUsersCsv(`email,name,role,password
TEST@example.com,Alice Admin,admin,hemligt
bob@example.com,Bob Deltagare,participant,
`);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			rowNumber: 2,
			email: 'test@example.com',
			name: 'Alice Admin',
			role: 'admin',
			ok: true,
			passwordProvided: true,
		});
		expect(rows[0].data?.passwordMode).toBe('provided');
		expect(rows[1].data?.passwordMode).toBe('generated');
	});

	it('marks duplicate emails in the same import as invalid', () => {
		const rows = parseBulkMeetingUsersCsv(`email,name,role
same@example.com,Forsta,participant
same@example.com,Andra,participant
`);

		expect(rows.every((row) => !row.ok)).toBe(true);
		expect(rows[0].errors[0]).toContain('E-postadressen forekommer flera ganger');
	});

	it('throws when the row limit is exceeded', () => {
		const header = 'email,name,role';
		const dataRows = Array.from(
			{ length: BULK_MEETING_USER_IMPORT_LIMIT + 1 },
			(_, index) => `person${index}@example.com,Person ${index},participant`,
		);

		expect(() => parseBulkMeetingUsersCsv([header, ...dataRows].join('\n'))).toThrow();
	});
});
