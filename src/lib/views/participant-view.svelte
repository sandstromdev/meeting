<script lang="ts">
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import { useNow } from '$lib/now.svelte';
	import { getMeetingContext } from '$lib/context.svelte';

	const ctx = getMeetingContext();

	const now = useNow();
</script>

{#if !ctx.meeting.startedAt || now.current < ctx.meeting.startedAt}
	<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
		<p class="text-center text-2xl font-semibold">Mötet har inte börjat ännu</p>
	</div>
{:else}
	<main class="mx-auto max-w-2xl space-y-4">
		<MeetingInfo />
		<CurrentAgendaItem />
		<Timer />
		<Agenda />
		<RequestView />
		<QueueControls />
		<SpeakerQueue />
	</main>
{/if}
