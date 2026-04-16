import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
import { getAppError } from '@lsnd/convex/helpers/error';
import { ConvexHttpClient } from 'convex/browser';
import type { DefaultFunctionArgs, FunctionReference, OptionalRestArgs } from 'convex/server';
import { ConvexError } from 'convex/values';
import { createContext } from 'svelte';

function shouldRetryConvexHttpAfterAuthRefresh(cause: unknown): boolean {
	const app = getAppError(cause);
	if (app && app.status === 401) {
		return true;
	}

	if (cause instanceof ConvexError) {
		const msg = String(cause.message ?? '').toLowerCase();
		if (msg.includes('unauthenticated') || msg.includes('not authenticated')) {
			return true;
		}
	}

	if (cause instanceof Error) {
		const msg = cause.message.toLowerCase();
		if (msg.includes('unauthorized') || msg.includes('unauthenticated')) {
			return true;
		}
		try {
			const j = JSON.parse(cause.message) as { code?: string };
			if (j?.code === 'Unauthenticated') {
				return true;
			}
		} catch {
			/* plain text error body */
		}
	}

	return false;
}

/**
 * HTTP Convex client for the signed-in app: wraps {@link ConvexHttpClient} and owns JWT sync (`ensureAuth`).
 * Obtain via {@link useAppHttpClient} for calls not scoped to a meeting; meeting surfaces compose
 * {@link MeetingHttpClient} on top of the same instance.
 */
export class AppHttpClient {
	readonly #http: ConvexHttpClient;
	readonly #syncAuth: () => Promise<void>;

	constructor(http: ConvexHttpClient, syncAuth: () => Promise<void>) {
		this.#http = http;
		this.#syncAuth = syncAuth;
	}

	/** Push session token onto the underlying client (or clear when logged out). */
	ensureAuth(): Promise<void> {
		return this.#syncAuth();
	}

	async #withAuthRetry<T>(run: () => Promise<T>): Promise<T> {
		try {
			return await run();
		} catch (e) {
			if (!shouldRetryConvexHttpAfterAuthRefresh(e)) {
				throw e;
			}
			await this.ensureAuth();
			return await run();
		}
	}

	query<Ref extends FunctionReference<'query', 'public', DefaultFunctionArgs, unknown>>(
		ref: Ref,
		...args: OptionalRestArgs<Ref>
	): Promise<Ref['_returnType']> {
		return this.#withAuthRetry(() => this.#http.query(ref, ...args));
	}

	mutation<Ref extends FunctionReference<'mutation', 'public', DefaultFunctionArgs, unknown>>(
		ref: Ref,
		...args: OptionalRestArgs<Ref>
	): Promise<Ref['_returnType']> {
		return this.#withAuthRetry(() => this.#http.mutation(ref, ...args));
	}
}

const [getContext, setContext] = createContext<AppHttpClient>();

export function initAppHttpClient() {
	const auth = useAuth();
	const convexHttpClient = new ConvexHttpClient(PUBLIC_CONVEX_URL);

	async function syncConvexJwt() {
		if (auth.isLoading) {
			return;
		}
		if (!auth.isAuthenticated) {
			convexHttpClient.clearAuth();
			return;
		}
		// Browser `fetchAccessToken` only hits `authClient.convex.token()` when this is true;
		// `false` returns null immediately (no cookies / no JWT), which clears Convex auth below.
		const token = await auth.fetchAccessToken({ forceRefreshToken: true });

		if (token) {
			convexHttpClient.setAuth(token);
		} else {
			convexHttpClient.clearAuth();
		}
	}

	if (!auth.isLoading) {
		void syncConvexJwt();
	}

	const appClient = new AppHttpClient(convexHttpClient, syncConvexJwt);

	setContext(appClient);
}

export function useAppHttpClient() {
	const ctx = getContext();
	if (!ctx) {
		throw new Error(
			'useAppHttpClient must be used under the root layout after initAppHttpClient().',
		);
	}
	return ctx;
}
