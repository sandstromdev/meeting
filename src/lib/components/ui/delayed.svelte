<script lang="ts">
	import type { WithChildren } from 'bits-ui';

	let { children, delay = 1000 }: WithChildren<{ delay?: number }> = $props();

	let show = $state(false);

	$effect(() => {
		const timer = setTimeout(() => {
			show = true;
		}, delay);

		return () => clearTimeout(timer);
	});
</script>

{#if show}
	{@render children?.()}
{/if}
