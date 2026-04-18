<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@fontsource-variable/nunito';
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta property="og:site_name" content="Omröstningar · lsnd" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="sv_SE" />
</svelte:head>

{@render children()}
