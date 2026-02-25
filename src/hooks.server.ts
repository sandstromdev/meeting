import { handleAuth } from '$lib/server/auth';
import { handleMeetingCookie } from '$lib/server/meeting-cookie';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(handleAuth, handleMeetingCookie);
