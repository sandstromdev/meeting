<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { Button, buttonVariants, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	let {
		ref = $bindable(null),
		variant = 'default',
		size = 'default',
		class: className,
		children,
		...restProps
	}: AlertDialogPrimitive.ActionProps & {
		variant?: ButtonProps['variant'];
		size?: ButtonProps['size'];
		loading?: boolean;
	} = $props();
</script>

<AlertDialogPrimitive.Action bind:ref data-slot="alert-dialog-action" {...restProps}>
	{#snippet child({ props })}
		<Button {...props} {variant} {size} class={className}>
			{@render children?.()}
		</Button>
	{/snippet}
</AlertDialogPrimitive.Action>
