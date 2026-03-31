<script lang="ts">
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import type { WithChildren } from 'bits-ui';

	let { message = 'Laddar...', children }: WithChildren<{ message?: string }> = $props();
</script>

<div class="flex items-center gap-2 text-muted-foreground">
	<LoaderCircleIcon class="size-4 animate-spin" />
	{#if children}
		{@render children?.()}
	{:else if message}
		{message}
	{/if}
</div>
