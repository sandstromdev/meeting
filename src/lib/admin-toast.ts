import { toast } from 'svelte-sonner';

const DEFAULT_ERROR = 'Något gick fel.';

/**
 * Runs an async action and shows success/error toasts.
 * Use `rethrow: true` when the caller must reject (e.g. confirm dialog should stay open on failure).
 */
export async function notifyMutation(
	successMessage: string,
	fn: () => Promise<unknown>,
	options?: { errorMessage?: string; rethrow?: boolean },
): Promise<void> {
	const errorMessage = options?.errorMessage ?? DEFAULT_ERROR;
	try {
		await fn();
		toast.success(successMessage);
	} catch (e) {
		console.error(e);
		toast.error(errorMessage);
		if (options?.rethrow) {
			throw e;
		}
	}
}
