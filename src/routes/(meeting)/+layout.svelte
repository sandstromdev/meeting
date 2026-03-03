<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Button from '$lib/components/ui/button/button.svelte';
	import Delayed from '$lib/components/ui/delayed.svelte';
	import MeetingContext from '$lib/meeting-context.svelte';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import LoadingIcon from '@lucide/svelte/icons/loader-circle';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { useQuery } from 'convex-svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const auth = useAuth();

	// svelte-ignore state_referenced_locally
	const meetingDataResult = useQuery(
		api.users.meeting.getData,
		() => (auth.isAuthenticated ? { meetingId: data.meetingId } : 'skip'),
		{
			initialData: data.meeting,
		},
	);
</script>

{#if meetingDataResult.data}
	<div class="mx-auto p-4 lg:py-12">
		<MeetingContext data={meetingDataResult.data}>
			{@render children()}
		</MeetingContext>
	</div>
{:else}
	<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
		{#if meetingDataResult.isLoading}
			<p class="flex items-center gap-2">
				<LoadingIcon class="size-4 animate-spin" />
				Laddar...
			</p>

			<Delayed delay={5000}>
				<Button onclick={() => location.reload()}>Ladda om sidan</Button>
			</Delayed>
		{:else}
			<p class="flex items-center gap-2">
				<AlertTriangleIcon class="size-4" />
				Du har inte tillgång till detta möte.
			</p>

			<Button variant="link" href="/anslut">Återgå till anslutningssidan</Button>
		{/if}
	</div>
{/if}
