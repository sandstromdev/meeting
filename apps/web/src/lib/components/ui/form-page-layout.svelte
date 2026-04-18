<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className,
	}: {
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('flex flex-col items-center gap-4 pt-[20vh]', className)}>
	{@render children()}
</div>
