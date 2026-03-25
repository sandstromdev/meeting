import { ConvexError, type Value } from 'convex/values';
import type { Id } from '$convex/_generated/dataModel';
import { ErrorMessages } from '$lib/errors';
import { z } from 'zod';

/** Convex serializes this as `ConvexError.data` for app-thrown errors. */
// oxlint-disable-next-line typescript/no-explicit-any
type AppConvexErrorData = Value;

/** Normalized shape after `super({ type: 'app_error', ... })`. */
type AppErrorStored<C extends string, P extends {}> = {
	type: 'app_error';
	code: C;
	status: number;
	data: P;
};

export class AppError<
	C extends string = string,
	P extends {} = {},
> extends ConvexError<AppConvexErrorData> {
	constructor(code: C, status: number, data?: P) {
		// oxlint-disable-next-line typescript/no-explicit-any
		super({ type: 'app_error', code, status, data: data ?? {} } as any);

		// oxlint-disable-next-line typescript/no-explicit-any
		this.message = ErrorMessages[code as AppErrorCode]({ ...data, status } as any);
	}

	private get stored() {
		return this.data as AppErrorStored<C, P>;
	}

	is<T extends AppErrorCode>(code: T): boolean {
		return this.stored.code === (code as string);
	}

	get code() {
		return this.stored.code;
	}

	get status() {
		return this.stored.status;
	}

	toJSON() {
		const { code, status, data } = this.stored;
		return {
			error: { code, status, ...data, message: this.message },
		};
	}

	toJsonResponse() {
		return Response.json(this.toJSON(), { status: this.status });
	}

	static fromConvex<P extends {}>(err: ConvexError<AppErrorStored<string, P>>) {
		const { code, status, data } = err.data;
		return new AppError(code, status, data ?? {});
	}

	static assert(pred: boolean, error: AppError): asserts pred is true {
		if (!pred) {
			throw error;
		}
	}

	static assertNotNull<T>(value: T | null | undefined, error: AppError): asserts value is T {
		if (value == null) {
			throw error;
		}
	}

	/** Narrows Zod `safeParse` / `SafeParseReturnType` to success; `toError` receives the `ZodError`. */
	static assertZodSuccess<T>(
		result: { success: true; data: T } | { success: false; error: z.ZodError },
		toError: (error: z.ZodError) => AppError = (e) => appErrors.zod_error(z.treeifyError(e)),
	): asserts result is { success: true; data: T } {
		if (!result.success) {
			throw toError(result.error);
		}
	}
}

export const appErrors = {
	// HTTP-shaped (401 / 403 / 500), no domain payload
	bad_request: (args: Record<string, Value | undefined>) =>
		new AppError('bad_request', 400, { args }),
	unauthorized: () => new AppError('unauthorized', 401),
	forbidden: () => new AppError('forbidden', 403),
	internal_error: () => new AppError('internal_error', 500),

	// Email & account
	email_exists: () => new AppError('email_exists', 400),
	invalid_credentials: () => new AppError('invalid_credentials', 400),
	participant_banned: () => new AppError('participant_banned', 403),

	// Meeting
	meeting_not_found: (args: { meetingId?: Id<'meetings'>; meetingCode?: string }) =>
		new AppError('meeting_not_found', 404, args),
	/** Meeting exists but is not joinable (participant / meeting-room flows). */
	meeting_archived: (args: { meetingId: Id<'meetings'>; meetingCode: string }) =>
		new AppError('meeting_archived', 410, args),
	meeting_participant_not_found: (meetingId: Id<'meetings'>) =>
		new AppError('meeting_participant_not_found', 404, { meetingId }),
	invalid_meeting_code: () => new AppError('invalid_meeting_code', 400),
	meeting_code_already_exists: (meetingCode: string) =>
		new AppError('meeting_code_already_exists', 400, { meetingCode }),

	// Agenda & speaking
	agenda_item_not_found: (agendaItemId: string) =>
		new AppError('agenda_item_not_found', 404, { agendaItemId }),
	cannot_delete_current_speaker: () => new AppError('cannot_delete_current_speaker', 400),
	cannot_leave_while_speaking: () => new AppError('cannot_leave_while_speaking', 400),
	illegal_while_absent: (action?: string) =>
		new AppError('illegal_while_absent', 400, action !== undefined ? { action } : undefined),

	// Meeting polls
	meeting_poll_not_found: (pollId: Id<'meetingPolls'>) =>
		new AppError('meeting_poll_not_found', 404, { pollId }),
	invalid_poll_option: (option: number) => new AppError('invalid_poll_option', 400, { option }),
	invalid_poll_vote_limit: (args: { maxVotesPerVoter: number; optionsCount: number }) =>
		new AppError('invalid_poll_vote_limit', 400, args),
	invalid_poll_type_config: (
		args:
			| { kind: 'winningCount'; value: number; optionsCount: number }
			| { kind: 'majorityRule_required' },
	) => new AppError('invalid_poll_type_config', 400, args),
	invalid_poll_draft: (error: z.ZodError) =>
		new AppError('invalid_poll_draft', 400, { error: z.treeifyError(error) }),
	illegal_meeting_poll_action: (
		action:
			| 'edit_while_open'
			| 'vote_while_closed'
			| 'already_voted'
			| 'agenda_has_poll'
			| 'too_many_votes'
			| 'duplicate_vote_option',
	) => new AppError('illegal_meeting_poll_action', 400, { action }),

	// User-owned (link) polls
	user_poll_not_found: (pollId: Id<'userPolls'>) =>
		new AppError('user_poll_not_found', 404, { pollId }),
	user_poll_code_not_found: (pollCode: string) =>
		new AppError('user_poll_code_not_found', 404, { pollCode }),
	illegal_user_poll_action: (
		action:
			| 'edit_while_open'
			| 'vote_while_closed'
			| 'too_many_votes'
			| 'duplicate_vote_option'
			| 'missing_session_key'
			| 'auth_required',
	) => new AppError('illegal_user_poll_action', 400, { action }),

	// Validation
	zod_error: (issues: z.core.$ZodErrorTree<unknown, string>) =>
		new AppError('zod_error', 400, { issues }),
} as const;

export type AppErrors = typeof appErrors;
export type AppErrorCode = keyof AppErrors;

export type AppErrorPayloadFor<K extends AppErrorCode> =
	ReturnType<AppErrors[K]> extends AppError<infer _C, infer P> ? P : never;

export type AppErrorBase<C extends string> = {
	code: C;
	status: number;
};

export type AppErrorMessages = {
	[K in AppErrorCode]: (args: Omit<AppErrorPayloadFor<K>, 'code'>) => string;
};

export const errorCodes = new Set<AppErrorCode>(Object.keys(appErrors) as AppErrorCode[]);

export function isAppError(err: unknown): err is ConvexError<AppErrorStored<string, {}>>;
export function isAppError<ErrorCode extends AppErrorCode>(
	err: unknown,
	code: ErrorCode,
): err is ConvexError<AppErrorStored<string, {}>>;
export function isAppError(err: unknown, code?: AppErrorCode) {
	if (!(err instanceof ConvexError)) {
		return false;
	}
	const d = err.data;
	if (typeof d !== 'object' || d === null || !('type' in d) || d.type !== 'app_error') {
		return false;
	}
	if (code !== undefined) {
		return d.code === code;
	}
	return true;
}

export function getAppError(err: unknown): AppError | null {
	return isAppError(err) ? AppError.fromConvex(err) : null;
}

export function isAppErrorCode(code: string): code is AppErrorCode {
	return errorCodes.has(code as AppErrorCode);
}
