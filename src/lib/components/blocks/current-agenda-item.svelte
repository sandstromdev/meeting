<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { getMeetingContext } from '$lib/context.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { usePageState } from '$lib/page-state.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';

	let { showNext = true }: { showNext?: boolean } = $props();

	const meeting = getMeetingContext();
	const ps = usePageState();
	const ag = meeting.agenda;
</script>

<section class="flex gap-2 rounded-lg border px-4 py-3">
	<div>
		<h2 class="text-sm font-semibold text-muted-foreground">Aktuell punkt</h2>

		{#if ag.currentItem}
			<div class="mt-2 space-y-1">
				<h3 class={cn('text-lg font-semibold', ps.isProjector && 'text-2xl')}>
					{ag.currentItem.number}. {ag.currentItem.title}
				</h3>
			</div>
			{#if showNext && ag.nextItem}
				<div class={cn('mt-2 text-sm text-muted-foreground', ps.isProjector && 'text-lg')}>
					<p>Nästa punkt: {ag.nextItem.number}. {ag.nextItem.title}</p>
				</div>
			{/if}
		{:else}
			<p class="mt-2 text-sm text-muted-foreground">Ingen aktuell punkt vald.</p>
		{/if}
	</div>

	{#if meeting.isAdmin && !ps.isProjector}
		<div class="ml-auto flex flex-col gap-2">
			<Button
				size="icon"
				variant="ghost"
				type="button"
				disabled={!ag.previousItem}
				onClickPromise={() => meeting.adminMutate(api.meeting.admin.agenda.previous)}
			>
				<ChevronUpIcon class="size-4" />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				type="button"
				disabled={!ag.nextItem}
				onClickPromise={() => meeting.adminMutate(api.meeting.admin.agenda.next)}
			>
				<ChevronDownIcon class="size-4" />
			</Button>
		</div>
	{/if}
</section>
