import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

const VOTER_SESSION_TOKEN_NAME = 'voter_session_token';

export function getVoterSessionToken(cookies: Cookies) {
	const cookie = cookies.get(VOTER_SESSION_TOKEN_NAME);

	const token = cookie ?? crypto.randomUUID();

	if (!cookie) {
		cookies.set(VOTER_SESSION_TOKEN_NAME, token, {
			path: '/',
			secure: !dev,
			httpOnly: true,
			maxAge: 60 * 60 * 24, // 1 day
			sameSite: 'lax',
		});
	}

	return token;
}
