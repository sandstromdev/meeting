import { describe, expect, it } from 'vitest';

import {
	BULK_MEETING_USER_IMPORT_LIMIT,
	DEFAULT_BULK_MEETING_USER_ROLE,
	parseBulkMeetingUsersCsv,
} from './bulkMeetingUsersCsv';

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

	it('defaults missing role column to participant', () => {
		const rows = parseBulkMeetingUsersCsv(`email,name,password
default@example.com,Standardanvandare,hemligt
`);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			email: 'default@example.com',
			name: 'Standardanvandare',
			role: DEFAULT_BULK_MEETING_USER_ROLE,
			ok: true,
		});
	});

	it('defaults blank role cells to participant', () => {
		const rows = parseBulkMeetingUsersCsv(`email,name,role
blank@example.com,Tom Roll,
`);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			email: 'blank@example.com',
			name: 'Tom Roll',
			role: DEFAULT_BULK_MEETING_USER_ROLE,
			ok: true,
		});
	});

	it('keeps the first row for a duplicate email and invalidates later rows', () => {
		const rows = parseBulkMeetingUsersCsv(`email,name,role
same@example.com,Forsta,participant
same@example.com,Andra,participant
same@example.com,Tredje,participant
`);

		expect(rows[0].ok).toBe(true);
		expect(rows[1].ok).toBe(false);
		expect(rows[1].errors.some((message) => message.includes('Dubblett'))).toBe(true);
		expect(rows[1].errors.some((message) => message.includes('rad 2'))).toBe(true);
		expect(rows[2].ok).toBe(false);
		expect(rows[2].errors.some((message) => message.includes('Dubblett'))).toBe(true);
		expect(rows[2].errors.some((message) => message.includes('rad 2'))).toBe(true);
	});

	it('throws when the row limit is exceeded', () => {
		const header = 'email,name';
		const dataRows = Array.from(
			{ length: BULK_MEETING_USER_IMPORT_LIMIT + 1 },
			(_, index) => `person${index}@example.com,Person ${index}`,
		);

		expect(() => parseBulkMeetingUsersCsv([header, ...dataRows].join('\n'))).toThrow();
	});
});
