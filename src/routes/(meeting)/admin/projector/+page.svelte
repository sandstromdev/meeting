<script lang="ts">
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
</script>

<main class="mx-auto grid max-w-6xl grid-cols-5 gap-4 p-4 lg:py-12">
	<div class="col-span-3 flex flex-col justify-center gap-4">
		<CurrentAgendaItem />
		<Timer />
	</div>

	<div class="col-span-2 flex flex-col rounded-lg border">
		<SpeakerQueue />
	</div>
</main>
