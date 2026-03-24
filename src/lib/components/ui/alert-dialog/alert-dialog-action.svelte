<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import {
		buttonVariants,
		type ButtonVariant,
		type ButtonSize,
	} from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import Button from '$lib/components/ui/button/button.svelte';

	let {
		ref = $bindable(null),
		class: className,
		variant = 'default',
		size = 'default',
		loading = false,
		children,
		...restProps
	}: AlertDialogPrimitive.ActionProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		loading?: boolean;
	} = $props();
</script>

<AlertDialogPrimitive.Action bind:ref data-slot="alert-dialog-action" {...restProps}>
	{#snippet child({ props })}
		<Button
			{...props}
			class={cn(buttonVariants({ variant, size }), 'cn-alert-dialog-action', className)}
			{variant}
			{size}
			{loading}
		>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogPrimitive.Action>
