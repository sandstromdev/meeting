<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className, children }: { class?: string; children: import('svelte').Snippet } =
		$props();
</script>

<div class={cn('grid gap-1.5 font-normal', className)}>
	{@render children()}
</div>
