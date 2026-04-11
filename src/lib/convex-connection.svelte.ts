import { browser } from '$app/environment';
import type { ConnectionState, ConvexClient } from 'convex/browser';
import type { Getter } from 'runed';
import { createContext, untrack } from 'svelte';

/** Milliseconds the realtime participant view waits after disconnect before simplified fallback */
export const DISCONNECT_REDIRECT_MS = 14_000;
/** Connection retry count threshold before immediate simplified fallback */
export const RETRY_REDIRECT_THRESHOLD = 14;

const fallback: ConnectionState = {
	isWebSocketConnected: false,
	hasEverConnected: false,
	connectionRetries: 0,
	hasInflightRequests: false,
	timeOfOldestInflightRequest: null,
	connectionCount: 0,
	inflightMutations: 0,
	inflightActions: 0,
};

const noop = () => {};

const [getConvexStatus, setContext] = createContext<ConvexStatus>();

class ConvexStatus {
	#snapshot = $state<ConnectionState>({ ...fallback });
	#unsubscribe: () => void;

	constructor(client: Getter<ConvexClient>) {
		this.#unsubscribe = noop;

		$effect(() => {
			if (!browser) {
				return;
			}

			const c = client();

			this.#unsubscribe = c.subscribeToConnectionState((s) => {
				untrack(() => {
					this.#snapshot = s;
				});
			});

			return () => {
				this.#unsubscribe();
				this.#unsubscribe = noop;
				this.#snapshot = { ...fallback };
			};
		});

		setContext(this);
	}

	get isWebSocketConnected() {
		return this.#snapshot.isWebSocketConnected;
	}

	get hasEverConnected() {
		return this.#snapshot.hasEverConnected;
	}

	get connectionRetries() {
		return this.#snapshot.connectionRetries;
	}

	get shouldScheduleFallback() {
		return this.#snapshot.hasEverConnected && !this.#snapshot.isWebSocketConnected;
	}

	shouldFallbackImmediately(retries = RETRY_REDIRECT_THRESHOLD) {
		return this.#snapshot.connectionRetries >= retries;
	}

	watchFallback(
		onFallback: () => void,
		delayMs = DISCONNECT_REDIRECT_MS,
		retries = RETRY_REDIRECT_THRESHOLD,
	) {
		let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

		const clearDisconnectTimer = () => {
			if (disconnectTimer) {
				clearTimeout(disconnectTimer);
				disconnectTimer = null;
			}
		};

		$effect(() => {
			console.log('should fallback immediately', this.shouldFallbackImmediately(retries));
			console.log('should schedule fallback', this.shouldScheduleFallback);

			const runFallback = () => {
				clearDisconnectTimer();
				onFallback();
			};

			if (this.shouldFallbackImmediately(retries)) {
				runFallback();
				return clearDisconnectTimer;
			}

			if (!this.shouldScheduleFallback) {
				return clearDisconnectTimer;
			}

			disconnectTimer = setTimeout(runFallback, delayMs);

			return clearDisconnectTimer;
		});

		return clearDisconnectTimer;
	}
}

export function initConvexStatus(client: Getter<ConvexClient>) {
	return new ConvexStatus(client);
}

export { getConvexStatus };
