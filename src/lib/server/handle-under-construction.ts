import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

/** Canonical URL for the temporary maintenance / under-construction page. */
export const UNDER_CONSTRUCTION_PATH = '/m/notice';

function shouldRedirectToNotice(pathname: string): boolean {
	if (pathname === UNDER_CONSTRUCTION_PATH || pathname.startsWith(`${UNDER_CONSTRUCTION_PATH}/`)) {
		return false;
	}
	if (pathname === '/m' || pathname.startsWith('/m/')) {
		return true;
	}
	if (pathname === '/meetings' || pathname.startsWith('/meetings/')) {
		return true;
	}
	return false;
}

export const handleUnderConstruction: Handle = async ({ event, resolve }) => {
	if (shouldRedirectToNotice(event.url.pathname)) {
		redirect(307, UNDER_CONSTRUCTION_PATH);
	}
	return resolve(event);
};
