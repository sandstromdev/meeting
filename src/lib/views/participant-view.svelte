<script lang="ts">
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import { cn } from '$lib/utils';

	let { class: className }: { class?: string } = $props();
</script>

<main class={cn('flex-1 space-y-4', className)}>
	<MeetingInfo />
	<Timer />
	<RequestView />
	<QueueControls />
	<SpeakerQueue />
</main>
