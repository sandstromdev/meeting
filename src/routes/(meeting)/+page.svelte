<script lang="ts">
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import UserControls from '$lib/components/blocks/user-controls.svelte';
	import ConfirmDialog from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte.js';
	import AdminView from '$lib/views/admin-view.svelte';
	import ModeratorView from '$lib/views/moderator-view.svelte';
	import ParticipantView from '$lib/views/participant-view.svelte';
	import ProjectorView from '$lib/views/projector-view.svelte';

	let { data } = $props();

	const ps = usePageState();
	const meeting = getMeetingContext();
</script>

<ConfirmDialog />

{#if meeting.isAdmin}
	<div class="absolute top-8 right-8">
		<ViewSelector compact triggerClass="" />
	</div>
{/if}

<div class="mx-auto space-y-8 p-4 lg:py-12">
	{#if meeting.isParticipant}
		<ParticipantView />
	{:else if meeting.role === 'moderator'}
		<ModeratorView />
	{:else if meeting.role === 'admin'}
		{#if ps.isProjector}
			<ProjectorView />
		{:else if ps.isQueue}
			<ModeratorView />
		{:else}
			<AdminView />
		{/if}
	{/if}
	{#if !ps.isProjector}
		<UserControls />
	{/if}
</div>
