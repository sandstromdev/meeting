import { ConvexError } from 'convex/values';
import type { Id } from '$convex/_generated/dataModel';
import { ErrorMessages } from '$lib/errors';
import type { z } from 'zod';

export const errors = {
	unauthorized: { code: 'unauthorized' },
	forbidden: { code: 'forbidden' },
	internal_error: { code: 'internal_error' },

	meeting_not_found: (args: { meetingId?: Id<'meetings'>; meetingCode?: string }) =>
		({ code: 'meeting_not_found', ...args }) as const,

	meeting_participant_not_found: (meetingId: Id<'meetings'>) =>
		({ code: 'meeting_participant_not_found', meetingId }) as const,

	poll_not_found: (pollId: Id<'polls'>) => ({ code: 'poll_not_found', pollId }) as const,
	invalid_poll_option: (option: number) => ({ code: 'invalid_poll_option', option }) as const,
	illegal_poll_action: (action: 'edit_while_open') =>
		({ code: 'illegal_poll_action', action }) as const,

	illegal_while_absent: (action?: string) => ({ code: 'illegal_while_absent', action }) as const,

	cannot_delete_current_speaker: () => ({ code: 'cannot_delete_current_speaker' }) as const,
	cannot_leave_while_speaking: () => ({ code: 'cannot_leave_while_speaking' }) as const,

	email_exists: { code: 'email_exists' },
	invalid_credentials: { code: 'invalid_credentials' },

	zod_error: (issues: z.core.$ZodErrorTree<unknown, string>) =>
		({ code: 'bad_args', issues }) as const,
} as const;

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

	// oxlint-disable-next-line typescript/no-explicit-any
	message = ErrorMessages[this.data.code as ErrorCode](this.data as any);

	static fromConvex<ErrorCode extends AppErrorCode, Data extends ClientErrorObject<ErrorCode>>(
		err: ConvexError<Data>,
	) {
		return new AppError<ErrorCode>(err.data);
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
