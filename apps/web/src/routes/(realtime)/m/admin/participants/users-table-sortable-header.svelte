<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';

	let { label, ...rest }: ComponentProps<typeof Button> & { label: string } = $props();
</script>

<Button variant="ghost" class={cn('-ms-4 h-8 px-2 lg:-ms-3', rest.class)} {...rest}>
	{label}
	<ArrowUpDownIcon class="ms-1 size-4 shrink-0 opacity-60" />
</Button>
