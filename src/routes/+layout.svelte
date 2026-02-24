<script lang="ts">
	import './layout.css';
	import '@fontsource-variable/nunito';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
