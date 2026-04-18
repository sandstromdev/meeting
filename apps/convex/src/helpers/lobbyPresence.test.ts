import { describe, expect, it } from 'vitest';

import { isLobbyPresenceFresh, LOBBY_PRESENCE_TTL_MS } from './lobbyPresence';

describe('lobbyPresence', () => {
	it('treats recent heartbeats as fresh', () => {
		const now = 1_000_000;
		expect(isLobbyPresenceFresh(now - 5_000, now, LOBBY_PRESENCE_TTL_MS)).toBe(true);
	});

	it('treats stale heartbeats as not fresh', () => {
		const now = 1_000_000;
		expect(isLobbyPresenceFresh(now - LOBBY_PRESENCE_TTL_MS - 1, now, LOBBY_PRESENCE_TTL_MS)).toBe(
			false,
		);
	});
});
