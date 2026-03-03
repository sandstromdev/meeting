<script lang="ts">
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import { getMeetingContext } from '$lib/context.svelte';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const cs = $derived(queue.current);
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-4 flex justify-end">
		<ViewSelector compact />
	</div>
	<div class="grid grid-cols-5 gap-4">
		<div class="col-span-3 flex flex-col justify-center">
			<Timer size="large" />
		</div>

		<div class="col-span-2 flex flex-col">
			<SpeakerQueue />
		</div>
	</div>
</div>
