<script lang="ts">
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead title="Profil" description="Din användarprofil och kontoinställningar." />

profile
