import { appErrors } from '@lsnd/convex/helpers/error';
import {
	BULK_MEETING_USER_IMPORT_LIMIT,
	bulkImportRawRowSchema,
	validationRowsFromNormalizedTable,
	type BulkImportRawRow,
	type BulkMeetingUserImportRow,
	type BulkMeetingUserImportValidationRow,
} from '$lib/bulkMeetingUsersCsv';

/**
 * Rows per `commitImportBatch` mutation. Convex enforces a short mutation runtime budget;
 * each row can run Better Auth + several DB writes, so keep this small.
 */
export const COMMIT_IMPORT_MUTATION_MAX_ROWS = 3;

export {
	BULK_MEETING_USER_IMPORT_LIMIT,
	bulkImportRawRowSchema,
	type BulkImportRawRow,
	type BulkMeetingUserImportRow,
	type BulkMeetingUserImportValidationRow,
} from '$lib/bulkMeetingUsersCsv';

export function serverValidateBulkImportRows(
	rawRows: BulkImportRawRow[],
): BulkMeetingUserImportValidationRow[] {
	if (rawRows.length === 0) {
		throw appErrors.bad_request({ reason: 'bulk_user_add_missing_rows' });
	}
	if (rawRows.length > BULK_MEETING_USER_IMPORT_LIMIT) {
		throw appErrors.bad_request({
			reason: 'bulk_user_add_row_limit_exceeded',
			limit: BULK_MEETING_USER_IMPORT_LIMIT,
		});
	}
	const sorted = [...rawRows].toSorted((a, b) => a.rowNumber - b.rowNumber);
	return validationRowsFromNormalizedTable(sorted);
}
