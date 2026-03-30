<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { type VariantProps, tv } from 'tailwind-variants';

	export const headingVariants = tv({
		base: 'scroll-m-20 text-balance text-current',
		variants: {
			size: {
				md: 'text-lg font-medium',
				lg: 'text-xl font-semibold',
				xl: 'text-2xl font-bold',
				'2xl': 'text-3xl font-bold tracking-tight',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	});

	export type HeadingLevel = '1' | '2' | '3' | '4' | '5' | '6';

	export type HeadingSize = VariantProps<typeof headingVariants>['size'];

	export type HeadingProps = WithElementRef<
		HTMLAttributes<HTMLHeadingElement>,
		HTMLHeadingElement
	> & {
		level?: HeadingLevel;
		size?: HeadingSize;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		level = '1',
		size = 'md',
		class: className,
		children,
		...restProps
	}: HeadingProps = $props();

	const tag = $derived(`h${level}` as `h${HeadingLevel}`);
</script>

<svelte:element
	this={tag}
	bind:this={ref}
	data-slot="heading"
	data-level={level}
	class={cn(headingVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
