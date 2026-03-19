<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import AddUserDialog from './add-user-dialog.svelte';
	import { ParticipantsContext } from './context.svelte';
	import Controls from './controls.svelte';
	import UsersTable from './users-table.svelte';

	const meeting = getMeetingContext();

	const ctx = new ParticipantsContext(meeting);
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
	<header class="flex items-center gap-4">
		<Button href={resolve('/m')} variant="outline" size="icon">
			<ArrowLeftIcon class="size-4" />
		</Button>
		<div>
			<h1 class="text-2xl font-bold">Deltagare</h1>
			<p class="text-sm text-muted-foreground">
				{ctx.counts.present} närvarande, {ctx.counts.absent} frånvarande
				{ctx.counts.banned > 0 ? `, ${ctx.counts.banned} avstängda` : ''}
			</p>
		</div>
	</header>

	{#if ctx.query.isLoading}
		<div class="flex items-center justify-center gap-2 text-muted-foreground">
			<LoaderCircleIcon class="size-4 animate-spin" /> Laddar deltagare...
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<UsersTable />
			<Controls />
			<AddUserDialog />
		</div>
	{/if}
</div>
