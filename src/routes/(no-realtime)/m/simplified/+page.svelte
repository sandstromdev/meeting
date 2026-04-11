<script lang="ts">
	import { computeAgendaNumbers } from '$convex/helpers/agenda';
	import Agenda from '$lib/components/blocks/agenda';
	import QueueControlsView from '$lib/components/blocks/queue-controls-view.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import InfoIcon from '@lucide/svelte/icons/info';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import MicIcon from '@lucide/svelte/icons/mic';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { page } from '$app/state';
	import { useAppHttpClient } from '$lib/app-http/app-http-client.svelte';
	import { createSimplifiedPolling } from './simplified-polling.svelte';
	import SimplifiedMeetingMotions from './simplified-meeting-motions.svelte';
	import SimplifiedPollDialog from './simplified-poll-dialog.svelte';

	const app = useAppHttpClient();
	const p = createSimplifiedPolling({
		app,
		getMeetingId: () => page.data.meetingId,
	});

	const meeting = $derived(p.meeting);

	const simplifiedAgendaFlat = $derived(
		computeAgendaNumbers(
			(p.coldSnapshot?.agenda ?? []).map((a) => ({
				id: a.id,
				title: a.title,
				description: a.description,
				depth: a.depth,
				pollIds: [],
			})),
		),
	);
	const simplifiedCurrentAgendaItemId = $derived(p.currentAgendaItemId);

	const meetingStatusLabel = $derived.by(() => {
		const s = meeting?.status;
		if (s === 'draft') {
			return 'Utkast';
		}
		if (s === 'scheduled') {
			return 'Planerat';
		}
		if (s === 'active') {
			return 'Aktivt';
		}
		if (s === 'closed') {
			return 'Avslutat';
		}
		if (s === 'archived') {
			return 'Arkiverat';
		}
		return '';
	});

	const meetingBlocked = $derived(
		meeting && (!meeting.isOpen || !meeting.startedAt || Date.now() < meeting.startedAt),
	);
</script>

<SeoHead
	title={`${meeting?.title ?? 'Möte'} – Deltagarevy`}
	description="Deltagarevy: se mötet i förenklat läge."
/>

<div class="mx-auto max-w-2xl space-y-4 p-4 lg:py-10">
	<Alert class="border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
		<WifiOffIcon />
		<AlertTitle>Förenklat läge</AlertTitle>
		<AlertDescription>
			<p>
				Anslutningen till realtidstjänsten är begränsad, men mötet kan användas ändå. Sidan
				uppdateras med jämna mellanrum, inte live.
			</p>
		</AlertDescription>
	</Alert>

	{#if p.loading}
		<p class="flex items-center gap-2 text-muted-foreground">
			<LoaderCircleIcon class="size-4 animate-spin" />
			Laddar möte…
		</p>
	{:else if p.fetchError}
		<Alert variant="destructive">
			<TriangleAlertIcon />
			<AlertTitle>Kunde inte ladda</AlertTitle>
			<AlertDescription class="space-y-3">
				<p>{p.fetchError}</p>
				<Button variant="outline" size="sm" onclick={() => p.retryFetch()}>
					<RefreshCwIcon class="size-4" />
					Försök igen
				</Button>
			</AlertDescription>
		</Alert>
	{:else if meeting}
		<header class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
			<p class="text-sm text-muted-foreground">
				Status: {meetingStatusLabel}
				{#if meeting.isOpen}
					· <span class="text-foreground">Öppet</span>
				{:else}
					· Stängt
				{/if}
			</p>
		</header>

		{#if p.actionError}
			<Alert variant="destructive">
				<TriangleAlertIcon />
				<AlertTitle>Åtgärden misslyckades</AlertTitle>
				<AlertDescription>{p.actionError}</AlertDescription>
			</Alert>
		{/if}

		{#if meetingBlocked}
			<p class="text-center text-lg font-medium">Mötet har inte börjat ännu</p>
		{:else}
			<div class="space-y-2">
				{#if (p.coldSnapshot?.agenda.length ?? 0) === 0}
					<h2 class="text-lg font-semibold">Dagordning</h2>
					<p class="text-sm text-muted-foreground">Ingen dagordning publicerad ännu.</p>
				{:else}
					<Agenda
						flat={simplifiedAgendaFlat}
						currentAgendaItemId={simplifiedCurrentAgendaItemId}
						initialOpen
					/>
				{/if}
			</div>

			<Separator />

			<SimplifiedMeetingMotions {p} meetingLive={!meetingBlocked} />

			<div class="space-y-2">
				<h2 class="text-lg font-semibold">Dina begäranden</h2>
				{#if p.canRecallReply}
					<Alert>
						<MessageSquareIcon />
						<AlertTitle>Begäran skickad</AlertTitle>
						<AlertDescription>Du har begärt replik och väntar på godkännande.</AlertDescription>
					</Alert>
				{/if}
				{#if p.canRecallPointOfOrder}
					<Alert>
						<ListOrderedIcon />
						<AlertTitle>Begäran skickad</AlertTitle>
						<AlertDescription
							>Du har begärt ordningsfråga och väntar på godkännande.</AlertDescription
						>
					</Alert>
				{/if}
				{#if p.isInSpeakerQueue}
					<Alert>
						<MicIcon />
						<AlertTitle>I talarkön</AlertTitle>
						<AlertDescription>Du står i talarkön och väntar på din tur.</AlertDescription>
					</Alert>
				{/if}
				{#if p.shouldRecallBreak}
					<Alert>
						<PauseIcon />
						<AlertTitle>Förslag skickat</AlertTitle>
						<AlertDescription>
							Du har föreslagit ett streck i debatten och väntar på godkännande.
						</AlertDescription>
					</Alert>
				{/if}
				{#if p.hasPendingReturnRequest}
					<Alert>
						<LogInIcon />
						<AlertTitle>Begäran skickad</AlertTitle>
						<AlertDescription>
							Du har begärt återkomst till mötet och väntar på godkännande.
						</AlertDescription>
					</Alert>
				{/if}
				{#if !p.canRecallReply && !p.canRecallPointOfOrder && !p.isInSpeakerQueue && !p.shouldRecallBreak && !p.hasPendingReturnRequest}
					<p class="text-sm text-muted-foreground">Inga aktiva begäranden från dig.</p>
				{/if}
			</div>

			<Separator />

			<div class="space-y-3 rounded-lg border p-4">
				{#if p.me?.absentSince}
					<p class="text-sm text-muted-foreground">Du är markerad som frånvarande.</p>
				{:else}
					<QueueControlsView
						noBorder
						absentSince={p.me?.absentSince ?? 0}
						isInQueue={p.isInSpeakerQueue}
						isFloorSpeaker={p.isFloorSpeaker}
						isQueuedCurrentSpeaker={p.isQueuedCurrentSpeaker}
						canJoinQueue={p.canJoinQueue}
						canRequestPointOfOrder={p.canRequestPointOfOrder}
						canRecallPointOfOrder={p.canRecallPointOfOrder}
						canRequestReply={p.canRequestReply}
						canRecallReply={p.canRecallReply}
						canRequestBreak={p.canRequestBreak}
						hasRequestedBreak={p.shouldRecallBreak}
						canMarkAbsent={p.canMarkAbsent}
						actionBusy={p.actionBusy}
						onDoneSpeaking={async () => {
							await p.doneSpeaking();
						}}
						onJoinQueue={async () => {
							await p.joinQueue();
						}}
						onLeaveQueue={async () => {
							await p.leaveQueue();
						}}
						onRequestPointOfOrder={async () => {
							await p.requestSlotAction('pointOfOrder');
						}}
						onRecallPointOfOrder={async () => {
							await p.recallSlotRequestAction('pointOfOrder');
						}}
						onRequestReply={async () => {
							await p.requestSlotAction('reply');
						}}
						onRecallReply={async () => {
							await p.recallSlotRequestAction('reply');
						}}
						onRequestBreak={async () => {
							await p.requestSlotAction('break');
						}}
						onRecallBreak={async () => {
							await p.recallSlotRequestAction('break');
						}}
						onMarkAbsent={async () => {
							await p.leaveMeeting();
						}}
					/>
				{/if}
			</div>

			<SimplifiedPollDialog {p} />

			<Separator />

			<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
				{#if !p.me?.absentSince}
					<Button
						variant="outline"
						disabled={p.actionBusy || !p.canMarkAbsent}
						onclick={() =>
							confirm({
								title: 'Markera frånvaro från mötet?',
								description: p.isInSpeakerQueue
									? 'Om du lämnar mötet förlorar du din plats i kön. För att komma tillbaka behöver du bli godkänd av mötesadmin.'
									: 'För att komma tillbaka behöver du bli godkänd av mötesadmin.',
								onConfirm: () => p.leaveMeeting(),
							})}
					>
						<LogOutIcon class="size-4" />
						Markera frånvaro
					</Button>
				{:else if !p.hasPendingReturnRequest}
					<Button variant="outline" disabled={p.actionBusy} onclick={() => p.requestReturnAction()}>
						<LogInIcon class="size-4" />
						Begär återkomst
					</Button>
				{:else}
					<Button variant="outline" disabled={p.actionBusy} onclick={() => p.recallReturnAction()}>
						Återkalla återkomst
					</Button>
				{/if}

				<Button variant="secondary" disabled={p.actionBusy} onclick={() => p.retryRealtimeNow()}>
					<InfoIcon class="size-4" />
					Försök realtidsläge igen
				</Button>
			</div>
		{/if}
	{/if}
</div>
