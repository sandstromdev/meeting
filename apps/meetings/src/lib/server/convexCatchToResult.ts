import { AppError, appErrors } from '@lsnd-mt/common/appError';
import { getAppError } from '@lsnd-mt/convex/helpers/error';

export function convexCatchToResult(
	e: unknown,
	logPrefix: string,
): {
	ok: false;
	error: AppError;
} {
	const appErr = getAppError(e);
	if (!appErr) {
		console.error(`[${logPrefix}] unexpected_error`, e);
	}
	const err = appErr ? AppError.fromJSON(appErr.toJSON()) : appErrors.internal_error();
	return { ok: false, error: err };
}
