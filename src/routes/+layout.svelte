<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import '@fontsource-variable/nunito';
	import { createSvelteAuthClient, useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import './layout.css';
	import { devState } from '$lib/dev.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	const auth = useAuth();

	const meetingDataResult = useQuery(api.users.meeting.getData, () =>
		data.meetingId ? { meetingId: data.meetingId } : 'skip',
	);
	const meeting = $derived(meetingDataResult.data);
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
				<td>{meeting?.me.name}</td>
			</tr>
			<tr>
				<td>Admin:</td>
				<td>{meeting?.me.isAdmin}</td>
			</tr>
			<tr>
				<td>Meeting:</td>
				<td>{meeting?.meeting.code}</td>
			</tr>
		</tbody>
	</table>

	{#if auth.isAuthenticated}
		<Button
			size="sm"
			class="h-6 text-xs"
			onClickPromise={() => authClient.signOut().then(() => location.reload())}>Logga ut</Button
		>
	{:else}
		<Button size="sm" class="h-6 text-xs" href="/sign-in">Logga in</Button>
	{/if}
</div>
