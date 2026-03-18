<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import '@fontsource-variable/nunito';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import './layout.css';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
