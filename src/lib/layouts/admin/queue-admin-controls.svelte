<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const hasBreak = $derived(queue.hasBreak);
	const hasPointOfOrder = $derived(queue.hasPointOfOrder);
</script>

<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
	{#if hasPointOfOrder}
		<Button onClickPromise={() => queue.clearPointOfOrder()} class="px-3" type="button">
			Avsluta ordningsfråga
		</Button>
	{:else}
		<Button onClickPromise={() => queue.prev()} class="px-3" disabled={!queue.canGoBack} type="button">
			Föregående talare
		</Button>
		<Button onClickPromise={() => queue.next()} class="px-3" disabled={!queue.canAdvance} type="button">
			Nästa talare
		</Button>
		<Button
			onClickPromise={() => queue.clearBreak()}
			class="px-3"
			disabled={!hasBreak}
			variant="outline"
			type="button"
		>
			Avsluta streck
		</Button>
	{/if}
</div>
