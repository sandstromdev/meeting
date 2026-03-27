<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { usePageState } from '$lib/page-state.svelte';
	import '@fontsource-variable/nunito';
	import ComputerIcon from '@lucide/svelte/icons/computer';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import { ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
	import './layout.css';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	const ps = usePageState();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />

{#if !ps.isProjector}
	<Toaster />
{/if}

{@render children()}

<div class="fixed right-0 bottom-0 p-4">
	<Button
		variant="outline"
		size="icon"
		onclick={() => {
			// toggle mode, and if user toggles again set to system
			if (userPrefersMode.current === 'dark') {
				setMode('light');
			} else if (userPrefersMode.current === 'light') {
				setMode('system');
			} else {
				setMode('dark');
			}
		}}
	>
		{#if userPrefersMode.current === 'dark'}
			<SunIcon />
		{:else if userPrefersMode.current === 'light'}
			<MoonIcon />
		{:else}
			<ComputerIcon />
		{/if}
	</Button>
</div>
