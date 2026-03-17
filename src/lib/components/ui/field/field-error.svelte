<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	let {
		ref = $bindable(null),
		class: className,
		children,
		errors,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		children?: Snippet;
		errors?: { message?: string }[] | string[];
	} = $props();

	const errs = $derived(
		errors?.map((error) => (typeof error === 'string' ? error : error.message)),
	);

	const hasContent = $derived.by(() => {
		// has slotted error
		if (children) {
			return true;
		}

		// no errors
		if (!errs || errs.length === 0) {
			return false;
		}

		// has an error but no message
		if (errs.length === 1 && !errs[0]) {
			return false;
		}

		return true;
	});

	const isMultipleErrors = $derived(errs && errs.length > 1);
	const singleErrorMessage = $derived(errs && errs.length === 1 && errs[0]);
</script>

{#if hasContent}
	<div
		bind:this={ref}
		role="alert"
		data-slot="field-error"
		class={cn('text-sm font-normal text-destructive', className)}
		{...restProps}
	>
		{#if children}
			{@render children()}
		{:else if singleErrorMessage}
			{singleErrorMessage}
		{:else if isMultipleErrors}
			<ul class="ms-4 flex list-disc flex-col gap-1">
				{#each errs ?? [] as error, index (index)}
					{#if error}
						<li>{error}</li>
					{/if}
				{/each}
			</ul>
		{/if}
	</div>
{/if}
