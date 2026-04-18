import { describe, expect, it, afterEach, vi } from 'vitest';

async function loadAuthModule() {
	vi.resetModules();
	return await import('./auth');
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe('getTrustedOrigins', () => {
	it('collects origins from env, trims, filters empties, and de-dupes (stable order)', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'https://site.example');
		vi.stubEnv('PUBLIC_CONVEX_SITE_URL', 'https://convex.example');
		vi.stubEnv(
			'TRUSTED_ORIGINS',
			' https://extra.example ;https://site.example;  ;https://convex.example ',
		);
		vi.stubEnv('ENVIRONMENT', 'development');

		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { getTrustedOrigins } = await loadAuthModule();
		const origins = getTrustedOrigins();

		expect(origins).toEqual([
			'https://site.example',
			'https://convex.example',
			'https://extra.example',
		]);
		expect(console.warn).not.toHaveBeenCalled();
	});

	it('prefers PUBLIC_BETTER_AUTH_URL over PUBLIC_SITE_URL', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'https://site.example');
		vi.stubEnv('PUBLIC_BETTER_AUTH_URL', 'https://auth.example');
		vi.stubEnv('PUBLIC_CONVEX_SITE_URL', 'https://convex.example');
		vi.stubEnv('ENVIRONMENT', 'development');

		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { getTrustedOrigins } = await loadAuthModule();
		const origins = getTrustedOrigins();

		expect(origins[0]).toBe('https://auth.example');
		expect(origins).toContain('https://convex.example');
	});

	it('warns when localhost is present outside development', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'https://site.example');
		vi.stubEnv('PUBLIC_CONVEX_SITE_URL', 'http://localhost:3210');
		vi.stubEnv('ENVIRONMENT', 'production');

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { getTrustedOrigins } = await loadAuthModule();

		// `auth.ts` calls `getTrustedOrigins()` once at import time for `options`.
		warn.mockClear();

		getTrustedOrigins();

		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenNthCalledWith(
			1,
			'Found localhost in trusted origins:',
			'http://localhost:3210',
		);
		expect(warn).toHaveBeenNthCalledWith(2, 'This is not recommended for production environments.');
	});

	it('does not warn about localhost during development', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'http://localhost:4000');
		vi.stubEnv('ENVIRONMENT', 'development');

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { getTrustedOrigins } = await loadAuthModule();

		// Clear any import-time calls (should be none in development).
		warn.mockClear();

		getTrustedOrigins();

		expect(warn).not.toHaveBeenCalled();
	});
});
