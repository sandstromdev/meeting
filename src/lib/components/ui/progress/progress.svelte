<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		max = 100,
		value,
		...restProps
	}: WithoutChildrenOrChild<ProgressPrimitive.RootProps> = $props();

	const progress = $derived(((value ?? 0) / max) * 100);
</script>

<ProgressPrimitive.Root
	bind:ref
	data-slot="progress"
	class={cn(
		'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-current/10 text-primary',
		className,
	)}
	{value}
	{max}
	{...restProps}
>
	<div
		data-slot="progress-indicator"
		class="size-full flex-1 bg-current transition-all"
		style="transform: translateX(-{100 - progress}%)"
	></div>
</ProgressPrimitive.Root>
