<script lang="ts">
	import MeetingInfo from '$lib/layouts/common/blocks/meeting-info.svelte';
	import RequestView from '$lib/layouts/common/blocks/request-view.svelte';
	import Timer from '$lib/layouts/common/blocks/timer.svelte';
	import SpeakerQueue from '$lib/layouts/common/blocks/speaker-queue.svelte';
	import QueueControls from '$lib/layouts/common/blocks/queue-controls.svelte';
</script>

<div class="mx-auto flex h-full max-w-2xl items-start gap-4">
	<main class="flex-1 space-y-4">
		<MeetingInfo />
		<Timer />
		<RequestView />
		<QueueControls />
		<SpeakerQueue />
	</main>
</div>
