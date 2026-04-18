<script lang="ts">
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<ViewSelector />

{@render children()}
