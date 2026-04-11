<script lang="ts">
	import Agenda from '$lib/components/blocks/agenda';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControlsMeeting from '$lib/components/blocks/queue-controls-meeting.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import { getConvexStatus } from '$lib/convex-connection.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useNow } from '$lib/now.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import { onMount } from 'svelte';

	const ctx = getMeetingContext();
	const convexStatus = getConvexStatus();
	const now = useNow();

	onMount(() => {
		return convexStatus.watchFallback(() => {
			goto(resolve('/m/simplified'));
		});
	});
</script>

<SeoHead
	title={`${ctx.meeting.title} – Deltagarevy`}
	description="Deltagarevy: se mötet i realtid."
/>

{#if !ctx.meeting.isOpen || !ctx.meeting.startedAt || now.current < ctx.meeting.startedAt}
	<div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
		<p class="text-center text-2xl font-semibold">Mötet har inte börjat ännu</p>
	</div>
{:else}
	<main class="mx-auto max-w-2xl space-y-4 p-4 lg:py-12">
		<MeetingInfo />
		<CurrentAgendaItem />
		<Timer />
		<Agenda flat={ctx.agenda.flat} currentAgendaItemId={ctx.agenda.currentAgendaItemId ?? null} />
		<RequestView />
		<QueueControlsMeeting />
		<SpeakerQueue />
	</main>
{/if}
