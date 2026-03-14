<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import '@fontsource-variable/nunito';
	import { createSvelteAuthClient } from '@mmailaender/convex-better-auth-svelte/svelte';
	import './layout.css';
	import { setupAuth, setupConvex, useAuth } from '@mmailaender/convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';

	let { children, data } = $props();

	createSvelteAuthClient({ authClient: authClient(fetch), getServerState: () => data.authState });

	// svelte-ignore state_referenced_locally
	// setupAuth(() => authClient, { initialState: data.authState });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
