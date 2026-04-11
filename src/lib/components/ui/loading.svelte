<script lang="ts">
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import type { WithChildren } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		message = 'Laddar...',
		children,
		class: className,
	}: WithChildren<{ message?: string; class?: string }> = $props();
</script>

<div class={cn('flex items-center gap-2 text-muted-foreground', className)}>
	<LoaderCircleIcon class="size-4 animate-spin" />
	{#if children}
		{@render children?.()}
	{:else if message}
		{message}
	{/if}
</div>
