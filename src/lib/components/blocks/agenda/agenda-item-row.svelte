<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import { hasBeenCompleted, type AgendaViewItem } from './agenda-helpers';
	import AgendaItemDefaultMain from './agenda-item-default-main.svelte';

	let {
		item,
		index,
		currentIndex,
		currentAgendaItemId,
		compactRows = false,
		itemLeading,
		itemMain,
		itemActions,
	}: {
		item: AgendaViewItem;
		index: number;
		currentIndex: number;
		currentAgendaItemId: string | null | undefined;
		compactRows?: boolean;
		itemLeading?: Snippet<[AgendaViewItem, number]>;
		itemMain?: Snippet<[AgendaViewItem, number]>;
		itemActions?: Snippet<[AgendaViewItem, number]>;
	} = $props();
</script>

<li class="not-last:border-b">
	<div
		class={cn(
			'flex gap-2 p-4 text-sm',
			compactRows && 'p-2',
			hasBeenCompleted(currentIndex, index) && 'bg-muted/50 text-muted-foreground',
			currentAgendaItemId != null &&
				item.id === currentAgendaItemId &&
				'[&:not(:has([data-agenda-item-editor]))]:bg-primary/10 [&:not(:has([data-agenda-item-editor]))]:text-primary',
		)}
	>
		{#if itemLeading}
			{@render itemLeading(item, index)}
		{/if}
		{#if itemMain}
			{@render itemMain(item, index)}
		{:else}
			<AgendaItemDefaultMain {item} {index} {currentIndex} />
		{/if}
		{#if itemActions}
			{@render itemActions(item, index)}
		{/if}
	</div>
</li>
