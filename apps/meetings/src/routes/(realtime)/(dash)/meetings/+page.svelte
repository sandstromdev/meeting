<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '@lsnd-mt/convex/_generated/api';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import CreateMeeting from './create-meeting.svelte';
	import MeetingsTable from './meetings-table.svelte';

	let { data } = $props();

	const convex = useConvexClient();
	const meetingsApi = api.meeting.platform.meetings;
	const meetings = useQuery(meetingsApi.listForCurrentUser);

	const user = $derived(data.currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');
</script>

<SeoHead title="Möten" description="Skapa, öppna och hantera dina möten." />
<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold">Möten</h1>

	{#if user === null}
		<Alert.Root variant="destructive">
			<AlertTriangle class="size-4" />
			<Alert.Title>Inloggning krävs</Alert.Title>
			<Alert.Description>
				<p>Du behöver vara inloggad för att skapa och hantera möten.</p>
				<Button
					variant="destructive"
					class="!no-underline"
					href={resolve(`/sign-in?redirect=${encodeURIComponent('/meetings')}`)}>Logga in</Button
				>
			</Alert.Description>
		</Alert.Root>
	{:else if !isAdmin}
		<Alert.Root variant="destructive">
			<AlertTriangle class="size-4" />
			<Alert.Title>Åtkomst krävs</Alert.Title>
			<Alert.Description>
				Endast administratörer kan skapa och hantera möten i nuläget.
				<a href={resolve(`/sign-in?redirect=${encodeURIComponent('/meetings')}`)} class="underline"
					>Logga in</a
				>.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<div class="space-y-4">
			<h2 class="text-lg font-medium">Mina möten</h2>
			<MeetingsTable {meetings} />
		</div>

		<CreateMeeting />
	{/if}
</div>
