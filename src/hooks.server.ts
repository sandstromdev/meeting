import { handleAuth } from '$lib/server/auth';
import { handleUnderConstruction } from '$lib/server/handle-under-construction';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(handleUnderConstruction, handleAuth);
