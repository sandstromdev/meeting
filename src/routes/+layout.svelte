<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import '@fontsource-variable/nunito';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { ModeWatcher } from 'mode-watcher';
	import './layout.css';
	import { usePageState } from '$lib/page-state.svelte';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	const ps = usePageState();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- <ModeWatcher  /> -->
{#if !ps.isProjector}
	<Toaster />
{/if}
{@render children()}
