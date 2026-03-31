<script lang="ts">
	import { cn } from '$lib/utils';
	import { Collapsible as CollapsiblePrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		open = $bindable(false),
		class: className,
		...restProps
	}: CollapsiblePrimitive.RootProps = $props();
</script>

<CollapsiblePrimitive.Root
	class={cn('overflow-hidden', className)}
	bind:ref
	bind:open
	data-slot="collapsible"
	{...restProps}
/>
