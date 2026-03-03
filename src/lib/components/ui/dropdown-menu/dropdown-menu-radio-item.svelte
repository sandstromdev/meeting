<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import { cn, type WithoutChild } from '$lib/utils.js';
	import { tv, type VariantProps } from 'tailwind-variants';

	const variants = tv({
		base: "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 px-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default: '',
				fill: 'data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground data-[state=checked]:pointer-events-none',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	});

	let {
		ref = $bindable(null),
		class: className,
		children: childrenProp,
		variant = 'default',
		...restProps
	}: WithoutChild<
		DropdownMenuPrimitive.RadioItemProps & { variant?: VariantProps<typeof variants>['variant'] }
	> = $props();
</script>

<DropdownMenuPrimitive.RadioItem
	bind:ref
	data-slot="dropdown-menu-radio-item"
	class={cn(variants({ variant }), className)}
	{...restProps}
>
	{#snippet children({ checked })}
		{#if variant !== 'fill'}
			<span class="pointer-events-none absolute start-2 flex size-3.5 items-center justify-center">
				{#if checked}
					<CircleIcon class="size-2 fill-current" />
				{/if}
			</span>
		{/if}
		{@render childrenProp?.({ checked })}
	{/snippet}
</DropdownMenuPrimitive.RadioItem>
