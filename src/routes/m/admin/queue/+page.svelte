<script lang="ts">
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import QueueAdminControls from '$lib/components/blocks/admin/queue-admin-controls.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import SeoHead from '$lib/components/ui/seo-head.svelte';

	const qCtx = getMeetingContext();
</script>

<SeoHead
	title={`${qCtx.meeting.title} – Talarkö`}
	description="Talarkö och dagordning för mötet."
/>

<main class="mx-auto max-w-2xl space-y-4 p-4 lg:py-12">
	<MeetingInfo />
	<CurrentAgendaItem />
	<Agenda />
	<Timer />
	<QueueAdminControls />
	<RequestView />
	<QueueControls />
	<SpeakerQueue />
</main>
