<script lang="ts">
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { resolve } from '$app/paths';
	import ConstructionIcon from '@lucide/svelte/icons/construction';
</script>

<SeoHead
	title="Under uppbyggnad"
	description="Mötesverktyget är tillfälligt stängt för underhåll."
/>

<MessageLayout>
	<p class="flex items-center gap-2 text-lg font-semibold">
		<ConstructionIcon class="size-7" />
		Under uppbyggnad
	</p>
	<p class="max-w-md text-center text-sm text-muted-foreground">
		Mötesverktyget är tillfälligt otillgängligt medan vi förbättrar tjänsten.
	</p>
	<Button href={resolve('/polls')}>Gå till omröstningar</Button>
</MessageLayout>
