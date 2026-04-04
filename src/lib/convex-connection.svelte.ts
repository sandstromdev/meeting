import { browser } from '$app/environment';
import type { ConvexClient } from 'convex/browser';
import { createContext, untrack } from 'svelte';

/** Milliseconds the realtime participant view waits after disconnect before simplified fallback */
export const DISCONNECT_REDIRECT_MS = 14_000;
/** Connection retry count threshold before immediate simplified fallback */
export const RETRY_REDIRECT_THRESHOLD = 14;

export type ConvexConnectionSnapshot = {
	isWebSocketConnected: boolean;
	hasEverConnected: boolean;
	connectionRetries: number;
};

const fallback: ConvexConnectionSnapshot = {
	isWebSocketConnected: false,
	hasEverConnected: false,
	connectionRetries: 0,
};

const noop = () => {};

const [getConvexStatus, setContext] = createContext<ConvexStatus>();

class ConvexStatus {
	#snapshot = $state<ConvexConnectionSnapshot>({ ...fallback });
	#unsubscribe: () => void;

	constructor(client: ConvexClient) {
		this.#unsubscribe = noop;

		const state = client.connectionState();
		this.#snapshot = {
			isWebSocketConnected: state.isWebSocketConnected,
			hasEverConnected: state.hasEverConnected,
			connectionRetries: state.connectionRetries,
		};

		$effect(() => {
			this.#unsubscribe();

			this.#unsubscribe = client.subscribeToConnectionState((s) => {
				untrack(() => {
					this.#snapshot = {
						isWebSocketConnected: s.isWebSocketConnected,
						hasEverConnected: s.hasEverConnected,
						connectionRetries: s.connectionRetries,
					};
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
	}
}

export function initConvexStatus(client: ConvexClient) {
	if (!browser) {return;}
	return new ConvexStatus(client);
}

export { getConvexStatus };
