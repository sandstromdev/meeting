<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_SITE_URL } from '$env/static/public';

	let {
		title,
		description,
	}: {
		title: string;
		description: string;
	} = $props();

	const documentTitle = $derived(`${title} · Mötesverktyg · m.lsnd.se`);
	const ogUrl = $derived(
		`${PUBLIC_SITE_URL.replace(/\/$/, '')}${page.url.pathname}${page.url.search}`,
	);
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={documentTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={ogUrl} />
</svelte:head>
