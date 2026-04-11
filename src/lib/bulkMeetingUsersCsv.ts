import { ROLES, type Role } from '$lib/roles';
import { z } from 'zod';

export const BULK_MEETING_USER_IMPORT_LIMIT = 200;
export const DEFAULT_BULK_MEETING_USER_ROLE: Role = 'participant';

export type BulkMeetingUsersCsvErrorReason =
	| 'bulk_user_add_invalid_csv_quotes'
	| 'bulk_user_add_empty_csv'
	| 'bulk_user_add_missing_columns'
	| 'bulk_user_add_missing_rows'
	| 'bulk_user_add_row_limit_exceeded';

export class BulkMeetingUsersCsvError extends Error {
	readonly reason: BulkMeetingUsersCsvErrorReason;
	readonly columns?: string;
	readonly limit?: number;

	constructor(reason: BulkMeetingUsersCsvErrorReason, init?: { columns?: string; limit?: number }) {
		super(reason);
		this.name = 'BulkMeetingUsersCsvError';
		this.reason = reason;
		if (init?.columns !== undefined) {
			this.columns = init.columns;
		}
		if (init?.limit !== undefined) {
			this.limit = init.limit;
		}
	}
}

const bulkMeetingUserRowSchema = z.object({
	email: z.string().email(),
	name: z.string().trim().min(1),
	role: z.enum(ROLES),
	password: z.string().min(4).optional(),
});

export type BulkMeetingUserImportRow = z.infer<typeof bulkMeetingUserRowSchema> & {
	rowNumber: number;
	passwordMode: 'provided' | 'generated';
};

export type BulkMeetingUserImportValidationRow = {
	rowNumber: number;
	email: string;
	name: string;
	role: string;
	passwordProvided: boolean;
	ok: boolean;
	errors: string[];
	data?: BulkMeetingUserImportRow;
};

export type BulkImportRawRow = {
	rowNumber: number;
	email: string;
	name: string;
	role: string;
	password?: string;
};

export const bulkImportRawRowSchema = z.object({
	rowNumber: z.number().int().positive(),
	email: z.string().max(500),
	name: z.string().max(500),
	role: z.string().max(80),
	password: z.string().max(500).optional(),
});

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function parseCsv(csvText: string): string[][] {
	const text = csvText.replace(/^\uFEFF/, '');
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];

		if (inQuotes) {
			if (char === '"') {
				if (text[index + 1] === '"') {
					field += '"';
					index += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}

		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}

		if (char === '\n' || char === '\r') {
			if (char === '\r' && text[index + 1] === '\n') {
				index += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}

		field += char;
	}

	if (inQuotes) {
		throw new BulkMeetingUsersCsvError('bulk_user_add_invalid_csv_quotes');
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

function getColumnIndex(headers: string[], name: string) {
	return headers.findIndex((header) => header === name);
}

/** Pulls logical rows from CSV text (client). Throws {@link BulkMeetingUsersCsvError} on structural issues. */
export function parseBulkMeetingUsersCsvToRawRows(csvText: string): BulkImportRawRow[] {
	const rows = parseCsv(csvText);

	if (rows.length === 0) {
		throw new BulkMeetingUsersCsvError('bulk_user_add_empty_csv');
	}

	const headers = rows[0].map((header) => header.trim().toLowerCase());
	const emailIndex = getColumnIndex(headers, 'email');
	const nameIndex = getColumnIndex(headers, 'name');
	const roleIndex = getColumnIndex(headers, 'role');
	const passwordIndex = getColumnIndex(headers, 'password');

	const missingColumns = [
		emailIndex === -1 ? 'email' : null,
		nameIndex === -1 ? 'name' : null,
	].filter((column): column is string => column !== null);

	if (missingColumns.length > 0) {
		throw new BulkMeetingUsersCsvError('bulk_user_add_missing_columns', {
			columns: missingColumns.join(','),
		});
	}

	const dataRows = rows.slice(1);
	if (dataRows.length === 0) {
		throw new BulkMeetingUsersCsvError('bulk_user_add_missing_rows');
	}

	if (dataRows.length > BULK_MEETING_USER_IMPORT_LIMIT) {
		throw new BulkMeetingUsersCsvError('bulk_user_add_row_limit_exceeded', {
			limit: BULK_MEETING_USER_IMPORT_LIMIT,
		});
	}

	return dataRows.map((row, index) => {
		const rowNumber = index + 2;
		const passwordRaw = passwordIndex >= 0 ? row[passwordIndex] : '';
		const passwordTrimmed = passwordRaw?.trim();
		const roleRaw = roleIndex >= 0 ? row[roleIndex] : '';
		const roleTrimmed = roleRaw?.trim().toLowerCase();
		return {
			rowNumber,
			email: normalizeEmail(row[emailIndex] ?? ''),
			name: (row[nameIndex] ?? '').trim(),
			role: roleTrimmed && roleTrimmed.length > 0 ? roleTrimmed : DEFAULT_BULK_MEETING_USER_ROLE,
			password: passwordTrimmed && passwordTrimmed.length > 0 ? passwordTrimmed : undefined,
		};
	});
}

/** Validates normalized rows (client preview or Convex after wire parse). */
export function validationRowsFromNormalizedTable(
	rawRows: BulkImportRawRow[],
): BulkMeetingUserImportValidationRow[] {
	const parsedRows = rawRows.map((row): BulkMeetingUserImportValidationRow => {
		const { rowNumber, email, name, role, password } = row;

		const result = bulkMeetingUserRowSchema.safeParse({
			email,
			name,
			role,
			password,
		});

		if (!result.success) {
			return {
				rowNumber,
				email,
				name,
				role,
				passwordProvided: password !== undefined,
				ok: false,
				errors: result.error.issues.map((issue) => issue.message),
			};
		}

		return {
			rowNumber,
			email,
			name,
			role,
			passwordProvided: password !== undefined,
			ok: true,
			errors: [],
			data: {
				...result.data,
				role: result.data.role as Role,
				rowNumber,
				passwordMode: password ? 'provided' : 'generated',
			},
		};
	});

	const duplicateRowsByEmail = new Map<string, number[]>();
	for (const row of parsedRows) {
		if (row.email.length === 0) {
			continue;
		}
		duplicateRowsByEmail.set(row.email, [
			...(duplicateRowsByEmail.get(row.email) ?? []),
			row.rowNumber,
		]);
	}

	for (const row of parsedRows) {
		const duplicateRows = duplicateRowsByEmail.get(row.email) ?? [];
		if (duplicateRows.length < 2) {
			continue;
		}
		row.ok = false;
		row.errors = [
			...row.errors,
			`E-postadressen forekommer flera ganger i importfilen (rader: ${duplicateRows.join(', ')}).`,
		];
		delete row.data;
	}

	return parsedRows;
}

/** Parse full CSV locally into validation rows (tests, optional client-only preview). */
export function parseBulkMeetingUsersCsv(csvText: string): BulkMeetingUserImportValidationRow[] {
	return validationRowsFromNormalizedTable(parseBulkMeetingUsersCsvToRawRows(csvText));
}
