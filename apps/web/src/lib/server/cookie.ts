import { dev } from '$app/environment';

export function getSecureCookieName(cookieName: string, secure = dev) {
	return `${!secure ? '__Secure-' : ''}${cookieName}`;
}
