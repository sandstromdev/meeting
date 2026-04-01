<script lang="ts">
	import ConfirmDialog from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<ConfirmDialog />
{@render children()}
