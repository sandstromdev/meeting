<script lang="ts">
	import ConfirmDialog from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
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

	let { data } = $props();

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

<ConfirmDialog />

{#if role === 'admin'}
	<div class="absolute top-8 right-8">
		<ViewSelector compact triggerClass="" />
	</div>
{/if}

<div class="mx-auto p-4 lg:py-12">
	{#if role === 'participant'}
		<ParticipantView />
	{:else if role === 'moderator'}
		<ModeratorView />
	{:else if role === 'admin'}
		{#if ps.isProjector}
			<ProjectorView />
		{:else if ps.isQueue}
			<ModeratorView />
		{:else}
			<AdminView />
		{/if}
	{/if}
</div>
