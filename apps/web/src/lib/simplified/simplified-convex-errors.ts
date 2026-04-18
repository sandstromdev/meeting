import { getAppError } from '@lsnd-mt/convex/helpers/error';
import { AppError } from '@lsnd-mt/common/appError';

/** Maps Convex / network failures to user-visible Swedish messages (parity with simplified data.remote throwRemoteError). */
export function messageFromSimplifiedConvexError(cause: unknown): string {
	const appError = getAppError(cause);

	if (appError) {
		return AppError.fromJSON(appError.toJSON()).message;
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return 'Kunde inte kontakta mötet.';
}
