<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type { Snippet } from 'svelte';
	import AgendaItemRow from './agenda-item-row.svelte';
	import type { AgendaViewItem } from './agenda-helpers';

	let {
		flat,
		currentAgendaItemId = null,
		initialOpen = false,
		compactRows = false,
		footer,
		itemLeading,
		itemMain,
		itemActions,
	}: {
		flat: AgendaViewItem[];
		currentAgendaItemId?: string | null;
		initialOpen?: boolean;
		compactRows?: boolean;
		footer?: Snippet;
		itemLeading?: Snippet<[AgendaViewItem, number]>;
		itemMain?: Snippet<[AgendaViewItem, number]>;
		itemActions?: Snippet<[AgendaViewItem, number]>;
	} = $props();

	const currentIndex = $derived.by(() => {
		if (currentAgendaItemId == null || currentAgendaItemId === '') {
			return -1;
		}
		return flat.findIndex((item) => item.id === currentAgendaItemId);
	});

	// Only seed Collapsible state from props on mount (legacy behavior).
	// svelte-ignore state_referenced_locally
	const open = $state(initialOpen);

	const mainStart = $derived(Math.max(0, currentIndex - 1));
	const mainEnd = $derived(
		currentIndex < 0 ? flat.length : Math.min(flat.length, currentIndex + 3),
	);
	const parts = $derived({
		previous: flat.slice(0, mainStart),
		main: flat.slice(mainStart, mainEnd),
		upcoming: flat.slice(mainEnd),
	});
</script>

<Collapsible class="rounded-lg border" {open}>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
	>
		<h2 class="font-semibold">Dagordning</h2>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>

	<CollapsibleContent>
		<div class="border-t">
			{#if flat.length === 0}
				<p class="px-4 py-3 text-sm text-muted-foreground">Inga agendapunkter ännu.</p>
			{:else}
				{#if parts.previous.length > 0}
					<Collapsible class="">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between border-b p-4 text-left text-sm hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
						>
							<span class="text-muted-foreground">Tidigare punkter ({parts.previous.length})</span>
							<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
						</CollapsibleTrigger>
						<CollapsibleContent>
							<ol class="border-t">
								{#each parts.previous as item, i (item.id)}
									<AgendaItemRow
										{item}
										index={i}
										{currentIndex}
										{currentAgendaItemId}
										{compactRows}
										{itemLeading}
										{itemMain}
										{itemActions}
									/>
								{/each}
							</ol>
						</CollapsibleContent>
					</Collapsible>
				{/if}

				<ol>
					{#each parts.main as item, i (item.id)}
						<AgendaItemRow
							{item}
							index={mainStart + i}
							{currentIndex}
							{currentAgendaItemId}
							{compactRows}
							{itemLeading}
							{itemMain}
							{itemActions}
						/>
					{/each}
				</ol>

				{#if parts.upcoming.length > 0}
					<Collapsible class="border-t">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between  p-4 text-left text-sm hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
						>
							<span class="text-muted-foreground">Kommande punkter ({parts.upcoming.length})</span>
							<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
						</CollapsibleTrigger>
						<CollapsibleContent>
							<ol class="border-t">
								{#each parts.upcoming as item, i (item.id)}
									<AgendaItemRow
										{item}
										index={mainEnd + i}
										{currentIndex}
										{currentAgendaItemId}
										{compactRows}
										{itemLeading}
										{itemMain}
										{itemActions}
									/>
								{/each}
							</ol>
						</CollapsibleContent>
					</Collapsible>
				{/if}
			{/if}

			{#if footer}
				{@render footer()}
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
