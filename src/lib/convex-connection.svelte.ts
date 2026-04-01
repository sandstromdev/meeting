import type { ConvexClient } from 'convex/browser';

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

/** Latest Convex browser connection metrics (updated from root layout subscription). */
export const convexConnection = $state<ConvexConnectionSnapshot>({ ...fallback });

let unsubscribe: (() => void) | null = null;

/**
 * Subscribe once to the shared Convex client connection state.
 * Call from root `+layout.svelte` after `createSvelteAuthClient`.
 */
export function subscribeConvexConnection(client: ConvexClient) {
	if (unsubscribe) {
		return unsubscribe;
	}

	unsubscribe = client.subscribeToConnectionState((s) => {
		convexConnection.isWebSocketConnected = s.isWebSocketConnected;
		convexConnection.hasEverConnected = s.hasEverConnected;
		convexConnection.connectionRetries = s.connectionRetries;
	});

	return () => {
		unsubscribe?.();
		unsubscribe = null;
		Object.assign(convexConnection, fallback);
	};
}
