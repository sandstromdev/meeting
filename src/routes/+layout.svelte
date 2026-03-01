<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import '@fontsource-variable/nunito';
	import { createSvelteAuthClient, useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import './layout.css';
	import { devState } from '$lib/dev.svelte';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	const auth = useAuth();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<div class="fixed bottom-4 left-4 hidden flex-col gap-1 md:flex">
	<table class="font-mono text-xs [&_td]:px-1">
		<tbody>
			<tr>
				<td>Auth:</td>
				<td>{auth.isAuthenticated}</td>
			</tr>
			<tr>
				<td>User:</td>
				<td>{data.currentUser?.name}</td>
			</tr>
			<tr>
				<td>Admin:</td>
				<td>{data.meeting?.me.isAdmin}</td>
			</tr>
			<tr>
				<td>Meeting:</td>
				<td>{data.meeting?.meeting.code}</td>
			</tr>
		</tbody>
	</table>

	<Button
		size="sm"
		class="h-6 text-xs"
		onclick={() => {
			devState.view = devState.view === 'admin' ? 'participant' : 'admin';
		}}>Switch view</Button
	>

	{#if auth.isAuthenticated}
		<Button size="sm" class="h-6 text-xs" onclick={() => authClient.signOut()}>Logga ut</Button>
	{:else}
		<Button size="sm" class="h-6 text-xs" href="/sign-in">Logga in</Button>
	{/if}
</div>
