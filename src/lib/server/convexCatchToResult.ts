import { type AppError, appErrors, getAppError } from '$convex/helpers/error';

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
	const err = appErr ?? appErrors.internal_error();
	return { ok: false, error: err };
}
