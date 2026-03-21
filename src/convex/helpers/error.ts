import { ConvexError, type Value } from 'convex/values';
import type { Id } from '$convex/_generated/dataModel';
import { ErrorMessages } from '$lib/errors';
import { z } from 'zod';
import type { MaybePromise } from './builder/types';
import { json } from '@sveltejs/kit';

type Shape =
	| {
			code: string;
			status: number;
			[key: string]: unknown;
	  }
	// oxlint-disable-next-line typescript/no-explicit-any
	| ((...args: any[]) => Shape);

export const errors = {
	unauthorized: { code: 'unauthorized', status: 401 },
	forbidden: { code: 'forbidden', status: 403 },
	internal_error: { code: 'internal_error', status: 500 },

	meeting_not_found: (args: { meetingId?: Id<'meetings'>; meetingCode?: string }) =>
		({ code: 'meeting_not_found', status: 404, ...args }) as const,

	meeting_participant_not_found: (meetingId: Id<'meetings'>) =>
		({ code: 'meeting_participant_not_found', status: 404, meetingId }) as const,

	agenda_item_not_found: (agendaItemId: string) =>
		({ code: 'agenda_item_not_found', status: 404, agendaItemId }) as const,

	poll_not_found: (pollId: Id<'polls'>) =>
		({ code: 'poll_not_found', status: 404, pollId }) as const,
	invalid_poll_option: (option: number) =>
		({ code: 'invalid_poll_option', status: 400, option }) as const,
	invalid_poll_vote_limit: (args: { maxVotesPerVoter: number; optionsCount: number }) =>
		({ code: 'invalid_poll_vote_limit', status: 400, ...args }) as const,
	invalid_poll_type_config: (
		args:
			| { kind: 'winningCount'; value: number; optionsCount: number }
			| { kind: 'majorityRule_required' },
	) => ({ code: 'invalid_poll_type_config', status: 400, ...args }) as const,
	invalid_poll_draft: (error: z.ZodError) =>
		({ code: 'invalid_poll_draft', status: 400, error: z.treeifyError(error) }) as const,
	illegal_poll_action: (
		action:
			| 'edit_while_open'
			| 'vote_while_closed'
			| 'already_voted'
			| 'agenda_has_poll'
			| 'too_many_votes'
			| 'duplicate_vote_option',
	) => ({ code: 'illegal_poll_action', status: 400, action }) as const,

	illegal_while_absent: (action?: string) =>
		({ code: 'illegal_while_absent', status: 400, action }) as const,

	cannot_delete_current_speaker: () =>
		({ code: 'cannot_delete_current_speaker', status: 400 }) as const,
	cannot_leave_while_speaking: () =>
		({ code: 'cannot_leave_while_speaking', status: 400 }) as const,

	email_exists: { code: 'email_exists', status: 400 },
	invalid_credentials: { code: 'invalid_credentials', status: 400 },
	invalid_meeting_code: { code: 'invalid_meeting_code', status: 400 },
	participant_banned: { code: 'participant_banned', status: 403 },

	zod_error: (issues: z.core.$ZodErrorTree<unknown, string>) =>
		({ code: 'bad_args', status: 400, issues }) as const,

	invalid_args: (args: Record<string, Value | undefined>) =>
		({ code: 'invalid_args', status: 400, args }) as const,

	meeting_code_already_exists: (meetingCode: string) =>
		({ code: 'meeting_code_already_exists', status: 400, meetingCode }) as const,
} as const satisfies Record<string, Shape>;

export const errorCodes = new Set<AppErrorCode>(Object.keys(errors) as AppErrorCode[]);

type AppErr = typeof errors;
type AppFlatErr = {
	// oxlint-disable-next-line typescript/no-explicit-any
	[P in keyof AppErr]: AppErr[P] extends (...args: any) => any ? ReturnType<AppErr[P]> : AppErr[P];
};

export type AppErrorObject = AppFlatErr[keyof AppFlatErr];

export type AppErrorCode = keyof AppErr;
export type AppErrorMessages = {
	[P in keyof AppFlatErr]: (args: Omit<AppFlatErr[P], 'code'>) => string;
};

export type AppErrorObjectFor<T extends AppErrorCode> = AppFlatErr[T];

type ClientErrorObject<T extends AppErrorCode> = {
	type: 'app_error';
	code: T;
} & AppFlatErr[T];

export class AppError<ErrorCode extends AppErrorCode> extends ConvexError<
	ClientErrorObject<ErrorCode>
> {
	constructor(error: AppFlatErr[ErrorCode]) {
		super({
			type: 'app_error',
			...error,
			// oxlint-disable-next-line typescript/no-explicit-any
		} as any);
	}

	is<T extends AppErrorCode>(code: T): this is AppError<T> {
		return this.data.code === code;
	}

	get code() {
		return this.data.code;
	}

	// oxlint-disable-next-line typescript/no-explicit-any
	message = ErrorMessages[this.data.code as AppErrorCode](this.data as any);

	get status() {
		return this.data.status;
	}

	toResponse(type: 'json' | 'text' = 'json') {
		return type === 'json'
			? json({ error: { ...this.data, message: this.message } }, { status: this.status })
			: new Response(this.message, { status: this.status });
	}

	static fromConvex<ErrorCode extends AppErrorCode, Data extends ClientErrorObject<ErrorCode>>(
		err: ConvexError<Data>,
	) {
		return new AppError<ErrorCode>(err.data);
	}

	static assert(pred: boolean, error: AppErrorObject): asserts pred is true {
		if (!pred) {
			throw new AppError(error);
		}
	}

	static assertNotNull<T>(value: T | null | undefined, error: AppErrorObject): asserts value is T {
		if (value == null) {
			throw new AppError(error);
		}
	}

	static async assertFn(pred: () => MaybePromise<boolean>, error: AppErrorObject) {
		const result = await pred();
		if (!result) {
			throw new AppError(error);
		}
	}
}

export function isAppError(err: unknown): err is ConvexError<ClientErrorObject<AppErrorCode>>;
export function isAppError<ErrorCode extends AppErrorCode>(
	err: unknown,
	code: ErrorCode,
): err is ConvexError<ClientErrorObject<ErrorCode>>;
export function isAppError(err: unknown, code?: AppErrorCode) {
	if (err instanceof ConvexError) {
		if (
			err != null &&
			typeof err.data === 'object' &&
			'type' in err.data &&
			err.data.type === 'app_error'
		) {
			if (code) {
				return err.data.code === code;
			}

			return true;
		}
	}

	return false;
}

export function getAppError(err: unknown) {
	if (!isAppError(err)) {
		return null;
	}

	return AppError.fromConvex(err);
}

export function isAppErrorCode(code: string): code is AppErrorCode {
	return errorCodes.has(code as AppErrorCode);
}
