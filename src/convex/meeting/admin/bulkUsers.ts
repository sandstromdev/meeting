import { api } from '$convex/_generated/api';
import { authed } from '$convex/helpers/auth';
import {
	BULK_MEETING_USER_IMPORT_LIMIT,
	COMMIT_IMPORT_MUTATION_MAX_ROWS,
	bulkImportRawRowSchema,
	serverValidateBulkImportRows,
	type BulkMeetingUserImportValidationRow,
} from '$convex/helpers/bulkMeetingUsers';
import { assertPlatformAdmin, findAuthUserByEmail } from '$convex/helpers/meetingAccess';
import { zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';

const ACTION_BATCH_SIZE = 10;

type PreviewRowResult = {
	rowNumber: number;
	email: string;
	name: string;
	role: string;
	passwordMode: 'provided' | 'generated';
	ok: boolean;
	outcome:
		| 'invalid'
		| 'already_in_meeting'
		| 'allow_and_add_existing_user'
		| 'add_participant'
		| 'create_allow_and_add_user';
	message: string;
	errors: string[];
};

type PreviewImportResult = {
	accessMode: 'open' | 'closed' | 'invite_only';
	limit: number;
	rows: PreviewRowResult[];
	summary: {
		total: number;
		valid: number;
		invalid: number;
		creates: number;
		existingUsers: number;
	};
};

type CommitRowResult = {
	rowNumber: number;
	email: string;
	name: string;
	role: string;
	passwordMode: 'provided' | 'generated';
	ok: boolean;
	outcome: string;
	message: string;
	errors: string[];
	createdUser?: boolean;
	passwordUpdated?: boolean;
	participantCreated?: boolean;
	accessGranted?: boolean;
	userId?: string;
};

type CommitImportResult = {
	limit: number;
	rows: CommitRowResult[];
	summary: {
		total: number;
		succeeded: number;
		failed: number;
		createdUsers: number;
		passwordUpdates: number;
		participantAdds: number;
	};
};

function buildInvalidRowResult(row: BulkMeetingUserImportValidationRow): PreviewRowResult {
	return {
		rowNumber: row.rowNumber,
		email: row.email,
		name: row.name,
		role: row.role,
		passwordMode: row.passwordProvided ? 'provided' : 'generated',
		ok: false,
		outcome: 'invalid',
		message: row.errors[0] ?? 'Raden innehåller ogiltiga värden.',
		errors: row.errors,
	};
}

async function mapInBatches<TInput, TOutput>(
	items: readonly TInput[],
	batchSize: number,
	mapper: (item: TInput) => Promise<TOutput>,
) {
	const results: TOutput[] = [];
	for (let index = 0; index < items.length; index += batchSize) {
		const batch = items.slice(index, index + batchSize);
		results.push(...(await Promise.all(batch.map((item) => mapper(item)))));
	}
	return results;
}

const bulkImportRowsInputSchema = z
	.array(bulkImportRawRowSchema)
	.min(1)
	.max(BULK_MEETING_USER_IMPORT_LIMIT);

export const previewImport = authed
	.action()
	.input({
		meetingId: zid('meetings'),
		rows: bulkImportRowsInputSchema,
	})
	.public(async ({ ctx, args }): Promise<PreviewImportResult> => {
		assertPlatformAdmin(ctx.user);

		const parsedRows = serverValidateBulkImportRows(args.rows);
		const importState = await ctx.runQuery(api.meeting.admin.access.getImportState, {
			meetingId: args.meetingId,
		});

		const validRows = parsedRows.flatMap((row) => (row.data ? [row.data] : []));
		const uniqueEmails = [...new Set(validRows.map((row) => row.email))];
		const batchedUserLookups = await mapInBatches(
			uniqueEmails,
			ACTION_BATCH_SIZE,
			async (email) => {
				const user = await findAuthUserByEmail(ctx, email);
				return user ? ([email, user] as const) : null;
			},
		);
		const usersByEmail = new Map(batchedUserLookups.flatMap((entry) => (entry ? [entry] : [])));

		const participantUserIds = new Set(importState.participantUserIds);
		const accessListUserIds = new Set(importState.accessListUserIds);
		const accessListEmails = new Set(importState.accessListEmails);

		const rows = parsedRows.map((row): PreviewRowResult => {
			if (!row.data) {
				return buildInvalidRowResult(row);
			}

			const existingUser = usersByEmail.get(row.data.email);
			const alreadyParticipant = existingUser ? participantUserIds.has(existingUser._id) : false;
			const alreadyAllowed = existingUser
				? accessListUserIds.has(existingUser._id)
				: accessListEmails.has(row.data.email);

			if (alreadyParticipant) {
				return {
					rowNumber: row.rowNumber,
					email: row.data.email,
					name: row.data.name,
					role: row.data.role,
					passwordMode: row.data.passwordMode,
					ok: true,
					outcome: 'already_in_meeting',
					message: 'Användaren finns redan i mötet och uppdateras vid behov.',
					errors: [],
				};
			}

			if (existingUser && alreadyAllowed) {
				return {
					rowNumber: row.rowNumber,
					email: row.data.email,
					name: row.data.name,
					role: row.data.role,
					passwordMode: row.data.passwordMode,
					ok: true,
					outcome: 'add_participant',
					message: 'Användaren har redan tillgång och läggs till som deltagare.',
					errors: [],
				};
			}

			if (existingUser) {
				return {
					rowNumber: row.rowNumber,
					email: row.data.email,
					name: row.data.name,
					role: row.data.role,
					passwordMode: row.data.passwordMode,
					ok: true,
					outcome: 'allow_and_add_existing_user',
					message: 'Befintlig användare får tillgång och läggs till i mötet.',
					errors: [],
				};
			}

			return {
				rowNumber: row.rowNumber,
				email: row.data.email,
				name: row.data.name,
				role: row.data.role,
				passwordMode: row.data.passwordMode,
				ok: true,
				outcome: 'create_allow_and_add_user',
				message: 'Ny användare skapas och läggs till i mötet.',
				errors: [],
			};
		});

		return {
			accessMode: importState.accessMode,
			limit: BULK_MEETING_USER_IMPORT_LIMIT,
			rows,
			summary: {
				total: rows.length,
				valid: rows.filter((row) => row.ok).length,
				invalid: rows.filter((row) => !row.ok).length,
				creates: rows.filter((row) => row.outcome === 'create_allow_and_add_user').length,
				existingUsers: rows.filter((row) =>
					['allow_and_add_existing_user', 'add_participant', 'already_in_meeting'].includes(
						row.outcome,
					),
				).length,
			},
		};
	});

export const commitImport = authed
	.action()
	.input({
		meetingId: zid('meetings'),
		rows: bulkImportRowsInputSchema,
	})
	.public(async ({ ctx, args }): Promise<CommitImportResult> => {
		assertPlatformAdmin(ctx.user);
		await ctx.runQuery(api.meeting.admin.access.getImportState, {
			meetingId: args.meetingId,
		});

		const parsedRows = serverValidateBulkImportRows(args.rows);

		const batchPayload = parsedRows.flatMap((row) => {
			if (!row.data) {
				return [];
			}
			const item = {
				rowNumber: row.rowNumber,
				email: row.data.email,
				name: row.data.name,
				role: row.data.role,
			};
			if (row.data.password !== undefined) {
				return [Object.assign(item, { password: row.data.password })];
			}
			return [item];
		});

		const batchByRowNumber = new Map<
			number,
			{
				rowNumber: number;
				email: string;
				name: string;
				role: string;
				ok: boolean;
				outcome: string;
				message: string;
				createdUser?: boolean;
				passwordUpdated?: boolean;
				participantCreated?: boolean;
				accessGranted?: boolean;
				userId?: string;
			}
		>();

		for (let offset = 0; offset < batchPayload.length; offset += COMMIT_IMPORT_MUTATION_MAX_ROWS) {
			const chunk = batchPayload.slice(offset, offset + COMMIT_IMPORT_MUTATION_MAX_ROWS);
			const { rows: batchRows } = await ctx.runMutation(
				api.meeting.admin.access.commitImportBatch,
				{
					meetingId: args.meetingId,
					rows: chunk,
				},
			);
			for (const batchRow of batchRows) {
				batchByRowNumber.set(batchRow.rowNumber, batchRow);
			}
		}

		const rows: CommitRowResult[] = parsedRows.map((row) => {
			if (!row.data) {
				const invalidRow = buildInvalidRowResult(row);
				return {
					rowNumber: invalidRow.rowNumber,
					email: invalidRow.email,
					name: invalidRow.name,
					role: invalidRow.role,
					passwordMode: invalidRow.passwordMode,
					ok: invalidRow.ok,
					outcome: invalidRow.outcome,
					message: invalidRow.message,
					errors: invalidRow.errors,
				};
			}

			const result = batchByRowNumber.get(row.rowNumber);
			if (!result) {
				return {
					rowNumber: row.rowNumber,
					email: row.data.email,
					name: row.data.name,
					role: row.data.role,
					passwordMode: row.data.passwordMode,
					ok: false,
					outcome: 'failed',
					message: 'Raden kunde inte importeras.',
					errors: ['Raden kunde inte importeras.'],
				};
			}

			return {
				rowNumber: row.rowNumber,
				email: result.email,
				name: result.name,
				role: result.role,
				passwordMode: row.data.passwordMode,
				ok: result.ok,
				outcome: result.outcome,
				message: result.message,
				errors: result.ok ? [] : [result.message],
				createdUser: result.createdUser,
				passwordUpdated: result.passwordUpdated,
				participantCreated: result.participantCreated,
				accessGranted: result.accessGranted,
				userId: result.userId,
			};
		});

		return {
			limit: BULK_MEETING_USER_IMPORT_LIMIT,
			rows,
			summary: {
				total: rows.length,
				succeeded: rows.filter((row) => row.ok).length,
				failed: rows.filter((row) => !row.ok).length,
				createdUsers: rows.filter((row) => row.createdUser).length,
				passwordUpdates: rows.filter((row) => row.passwordUpdated).length,
				participantAdds: rows.filter((row) => row.participantCreated).length,
			},
		};
	});
