<script lang="ts">
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import {
		convexConnection,
		DISCONNECT_REDIRECT_MS,
		RETRY_REDIRECT_THRESHOLD,
	} from '$lib/convex-connection.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useNow } from '$lib/now.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/ui/seo-head.svelte';

	let { data } = $props();

	const ctx = getMeetingContext();
	const now = useNow();

	$effect(() => {
		const role = data.meeting.data?.me.role;
		if (role !== 'participant' && role !== 'adjuster') {
			return;
		}

		const { connectionRetries, isWebSocketConnected, hasEverConnected } = convexConnection;

		let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

		const clearDisconnectTimer = () => {
			if (disconnectTimer) {
				clearTimeout(disconnectTimer);
				disconnectTimer = null;
			}
		};

		const goSimplified = () => {
			clearDisconnectTimer();
			void goto(resolve('/m/simplified'));
		};

		if (connectionRetries >= RETRY_REDIRECT_THRESHOLD) {
			goSimplified();
			return () => clearDisconnectTimer();
		}

		if (isWebSocketConnected || !hasEverConnected) {
			return () => clearDisconnectTimer();
		}

		disconnectTimer = setTimeout(goSimplified, DISCONNECT_REDIRECT_MS);

		return () => clearDisconnectTimer();
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
		<Agenda />
		<RequestView />
		<QueueControls />
		<SpeakerQueue />
	</main>
{/if}
