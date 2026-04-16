import { getAppError } from '$convex/helpers/error';

/** Maps Convex / network failures to user-visible Swedish messages (parity with simplified data.remote throwRemoteError). */
export function messageFromSimplifiedConvexError(cause: unknown): string {
	const appError = getAppError(cause);

	if (appError) {
		return appError.message;
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return 'Kunde inte kontakta mötet.';
}
