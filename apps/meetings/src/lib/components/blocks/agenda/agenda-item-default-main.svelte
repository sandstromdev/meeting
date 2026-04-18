<script lang="ts">
	import { cn } from '$lib/utils';
	import { hasBeenCompleted, type AgendaViewItem } from './agenda-helpers';

	let {
		item,
		index,
		currentIndex,
	}: {
		item: AgendaViewItem;
		index: number;
		currentIndex: number;
	} = $props();
</script>

<span class="flex shrink-0 items-baseline font-mono text-current/70">
	{item.number}.
</span>
<span class={cn('text-sm font-medium', hasBeenCompleted(currentIndex, index) && 'line-through')}>
	{item.title}
</span>
