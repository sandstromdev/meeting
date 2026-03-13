<script lang="ts">
	import PollDialog from '$lib/components/blocks/poll-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte.js';
	import AdminView from '$lib/views/admin-view.svelte';
	import ParticipantView from '$lib/views/participant-view.svelte';
	import ProjectorView from '$lib/views/projector-view.svelte';
	import ModeratorView from '$lib/views/moderator-view.svelte';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import MeetingContext from '$lib/meeting-context.svelte';
	import Delayed from '$lib/components/ui/delayed.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import LoadingIcon from '@lucide/svelte/icons/loader-circle';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const auth = useAuth();
	// svelte-ignore state_referenced_locally
	const meetingDataResult = useQuery(
		api.users.meeting.getData,
		() => (auth.isAuthenticated ? { meetingId: data.meetingId } : 'skip'),
		{
			initialData: data.meeting,
			keepPreviousData: true,
		},
	);

	const ps = usePageState();

	const role = $derived(meetingDataResult.data?.me.role);
</script>

{#if meetingDataResult.data}
	<MeetingContext data={meetingDataResult.data}>
		<PollDialog />
		{@render children()}
	</MeetingContext>
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
