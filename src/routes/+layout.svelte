<script lang="ts">
	import './layout.css';
	import '@fontsource-variable/nunito';
	import favicon from '$lib/assets/favicon.svg';
	import { createSvelteAuthClient, useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import { setupConvex, useQuery } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { api } from '$convex/_generated/api';

	let { children, data } = $props();

	setupConvex(PUBLIC_CONVEX_URL);
	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	const auth = useAuth();

	// svelte-ignore state_referenced_locally
	const meeting = useQuery(
		api.meetings.getMeetingById,
		() => (auth.isAuthenticated && data.meeting ? { meetingId: data.meeting._id } : 'skip'),
		{
			initialData: data.meeting,
			keepPreviousData: true
		}
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<div class="fixed bottom-4 left-4 flex flex-col gap-2">
	<p>Authenticated: {auth.isAuthenticated}</p>
	<p>Meeting: {meeting.data?.code}</p>
	{#if auth.isAuthenticated}
		<Button onclick={() => authClient.signOut()}>Logga ut</Button>
	{:else}
		<Button href="/sign-in">Logga in</Button>
	{/if}
</div>
