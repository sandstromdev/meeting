<script lang="ts">
	import * as FormPrimitive from 'formsnap';
	import { cn, type WithoutChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		errorClasses,
		children: childrenProp,
		...restProps
	}: WithoutChild<FormPrimitive.FieldErrorsProps> & {
		errorClasses?: string | undefined | null;
	} = $props();

	const f = FormPrimitive.useFormField({});
	const hasErrors = $derived(f.errors.length > 0);
</script>

{#if hasErrors}
	<FormPrimitive.FieldErrors
		bind:ref
		class={cn('text-sm font-medium text-destructive', className)}
		{...restProps}
	>
		{#snippet children({ errors, errorProps })}
			{#if childrenProp}
				{@render childrenProp({ errors, errorProps })}
			{:else}
				{#each errors as error (error)}
					<div {...errorProps} class={cn(errorClasses)}>{error}</div>
				{/each}
			{/if}
		{/snippet}
	</FormPrimitive.FieldErrors>
{/if}
