import { dev } from '$app/environment';
import { api } from '$convex/_generated/api';
import { getCurrentUser } from '$lib/server/auth';
import { convexLoad } from '@mmailaender/convex-svelte/sveltekit';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

async function getVoterSessionToken(id: string) {
	return new Uint8Array(
		await crypto.subtle.digest('sha-256', new TextEncoder().encode(id)),
	).toHex();
}

export const load = (async ({ params, cookies }) => {
	const currentUser = await getCurrentUser();

	const cookie = cookies.get('voter_session');
	let rawVoterSession;

	if (currentUser) {
		rawVoterSession = currentUser._id;
	} else if (cookie) {
		rawVoterSession = cookie;
	} else {
		rawVoterSession = crypto.randomUUID();
	}

	if (!cookie) {
		cookies.set('voter_session', rawVoterSession, {
			path: '/',
			secure: !dev,
			httpOnly: true,
			maxAge: 60 * 60 * 24, // 1 day
			sameSite: 'lax',
		});
	}

	const voterSessionToken = await getVoterSessionToken(rawVoterSession);

	const poll = await convexLoad(api.public.standalone_poll.get_by_code, {
		code: params.code,
		voterSessionToken,
	});

	if (!poll.data) {
		throw error(404, 'Omröstningen hittades inte');
	}

	if (poll.data?.visibilityMode === 'account_required' && !currentUser) {
		throw redirect(302, `/sign-in?redirect=${encodeURIComponent(`/p/${params.code}`)}`);
	}

	const voteCounts = await convexLoad(api.public.standalone_poll.get_vote_counts, {
		pollId: poll.data.id,
	});

	return {
		poll,
		voteCounts,
		currentUser,
		voterSessionToken,
	};
}) satisfies PageServerLoad;
