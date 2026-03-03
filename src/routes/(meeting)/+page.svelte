<script lang="ts">
	import ConfirmDialog from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte.js';
	import AdminView from '$lib/views/admin-view.svelte';
	import ParticipantView from '$lib/views/participant-view.svelte';
	import ProjectorView from '$lib/views/projector-view.svelte';
	import QueueView from '$lib/views/queue-view.svelte';
	import { useAuth } from '@mmailaender/convex-better-auth-svelte/svelte';

	let { data: propsData } = $props();

	const auth = useAuth();
	const ctx = getMeetingContext();

	const isAdmin = $derived(ctx.me?.isAdmin ?? false);

	const ps = usePageState();
</script>

<ConfirmDialog />

<div class="mx-auto p-4 lg:py-12">
	{#if isAdmin}
		{#if ps.isProjector}
			<ProjectorView />
		{:else if ps.isQueue}
			<QueueView />
		{:else}
			<AdminView />
		{/if}
	{:else}
		<div class="mx-auto flex h-full max-w-2xl items-start gap-4">
			<ParticipantView />
		</div>
	{/if}
</div>
