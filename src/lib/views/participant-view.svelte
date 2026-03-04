<script lang="ts">
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
</script>

<main class="mx-auto max-w-2xl space-y-4">
	<MeetingInfo />
	<CurrentAgendaItem />
	<Timer />
	<Agenda />
	<RequestView />
	<QueueControls />
	<SpeakerQueue />
</main>
