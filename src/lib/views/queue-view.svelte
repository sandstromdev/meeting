<script lang="ts">
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import QueueAdminControls from '$lib/components/blocks/admin/queue-admin-controls.svelte';
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-4 flex justify-end">
		<ViewSelector compact />
	</div>
	<main class="space-y-4">
		<MeetingInfo />
		<Timer />
		<QueueAdminControls />
		<RequestView />
		<QueueControls />
		<SpeakerQueue />
	</main>
</div>
