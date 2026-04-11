<script lang="ts">
	import { computeAgendaNumbers } from '$convex/helpers/agenda';
	import Agenda from '$lib/components/blocks/agenda';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as RadioGroup from '$lib/components/ui/radio-group';
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
	import { SvelteSet } from 'svelte/reactivity';
	import { createSimplifiedPolling } from './simplified-polling.svelte';

	/*
	TODO: Leave queue does not work in simplified mode.
	TODO: Agenda is not updated in realtime.
	TODO: Poll does not open as dialog
	*/

	const app = useAppHttpClient();
	const p = createSimplifiedPolling({
		app,
		getMeetingId: () => page.data.meetingId,
	});

	let selectedOptionIndexes = new SvelteSet<number>();

	const poll = $derived(p.poll);
	const meeting = $derived(p.meeting);

	const simplifiedAgendaFlat = $derived(
		computeAgendaNumbers(
			(p.coldSnapshot?.agenda ?? []).map((a) => ({
				id: a.id,
				title: a.title,
				depth: a.depth,
				pollIds: [],
			})),
		),
	);
	const simplifiedCurrentAgendaItemId = $derived(p.currentAgendaItemId);

	const isMultiWinner = $derived(poll?.type === 'multi_winner');

	const effectiveSelection = $derived(
		poll
			? [...selectedOptionIndexes]
					.filter((i) => i >= 0 && i < poll.options.length)
					.toSorted((a, b) => a - b)
					.slice(0, poll.maxVotesPerVoter)
			: [],
	);

	const hasVoted = $derived(p.myPollVoteOptionIndexes.length > 0);

	let isChangingVote = $state(false);
	let isSubmittingVote = $state(false);

	const canSubmitVote = $derived(
		!!poll &&
			poll.isOpen &&
			effectiveSelection.length > 0 &&
			effectiveSelection.length <= poll.maxVotesPerVoter &&
			(!hasVoted || isChangingVote),
	);

	$effect(() => {
		if (!poll?.isOpen) {
			selectedOptionIndexes.clear();
			isChangingVote = false;
			return;
		}
		if (isChangingVote) {
			return;
		}
		selectedOptionIndexes.clear();
		for (const i of p.myPollVoteOptionIndexes) {
			selectedOptionIndexes.add(i);
		}
	});

	function toggleOption(optionIndex: number, checked: boolean) {
		if (!poll?.isOpen || (hasVoted && !isChangingVote)) {
			return;
		}
		if (isMultiWinner) {
			if (!checked) {
				selectedOptionIndexes.delete(optionIndex);
			} else if (selectedOptionIndexes.size < poll.maxVotesPerVoter) {
				selectedOptionIndexes.add(optionIndex);
			}
		} else if (checked) {
			selectedOptionIndexes.clear();
			selectedOptionIndexes.add(optionIndex);
		}
	}

	async function submitVote() {
		if (!poll || !canSubmitVote) {
			return;
		}
		isSubmittingVote = true;
		try {
			await p.vote(poll.id, effectiveSelection);
			isChangingVote = false;
		} finally {
			isSubmittingVote = false;
		}
	}

	async function retractVote() {
		if (!poll) {
			return;
		}
		isSubmittingVote = true;
		try {
			await p.retractVote(poll.id);
			isChangingVote = false;
		} finally {
			isSubmittingVote = false;
		}
	}

	function enterChangeVote() {
		isChangingVote = true;
		selectedOptionIndexes.clear();
	}

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

	function canSelectMoreOptions() {
		return selectedOptionIndexes.size < (poll?.maxVotesPerVoter ?? 1);
	}

	function isOptionDisabled(optionIndex: number) {
		if (!poll?.isOpen) {
			return true;
		}
		if (hasVoted && !isChangingVote) {
			return true;
		}
		return isMultiWinner && !canSelectMoreOptions() && !selectedOptionIndexes.has(optionIndex);
	}
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
				<h2 class="text-lg font-semibold">Talare</h2>
				{#if p.me?.absentSince}
					<p class="text-sm text-muted-foreground">Du är markerad som frånvarande.</p>
				{:else}
					<div class="flex flex-col gap-2">
						<Button
							class="w-full"
							disabled={p.actionBusy || (!p.isInSpeakerQueue && !p.canJoinQueue)}
							onclick={() => (p.isInSpeakerQueue ? p.leaveQueue() : p.joinQueue())}
						>
							{#if p.isInSpeakerQueue}
								<LogOutIcon class="size-4" />
								Gå ur kön
							{:else}
								<MicIcon class="size-4" />
								Ställ dig i kön
							{/if}
						</Button>
					</div>

					<Separator />

					<div class="grid gap-2 sm:grid-cols-3">
						{#if p.canRequestReply}
							<Button
								variant="outline"
								disabled={p.actionBusy}
								onclick={() => p.requestSlotAction('reply')}
							>
								Begär replik
							</Button>
						{:else if p.canRecallReply}
							<Button
								variant="outline"
								disabled={p.actionBusy}
								onclick={() => p.recallSlotRequestAction('reply')}
							>
								Återkalla replik
							</Button>
						{/if}

						{#if p.canRequestPointOfOrder}
							<Button
								variant="outline"
								disabled={p.actionBusy}
								onclick={() => p.requestSlotAction('pointOfOrder')}
							>
								Ordningsfråga
							</Button>
						{:else if p.canRecallPointOfOrder}
							<Button
								variant="outline"
								disabled={p.actionBusy}
								onclick={() => p.recallSlotRequestAction('pointOfOrder')}
							>
								Återkalla ordningsfråga
							</Button>
						{/if}

						{#if !p.shouldRecallBreak}
							<Button
								variant="outline"
								disabled={p.actionBusy || !p.canRequestBreak}
								onclick={() => p.requestSlotAction('break')}
							>
								Föreslå streck
							</Button>
						{:else}
							<Button
								variant="outline"
								disabled={p.actionBusy}
								onclick={() => p.recallSlotRequestAction('break')}
							>
								Återkalla streck
							</Button>
						{/if}
					</div>
				{/if}
			</div>

			{#if poll}
				<Separator />
				<div class="space-y-3 rounded-lg border p-4">
					<h2 class="text-lg font-semibold">{poll.title}</h2>
					<p class="text-sm text-muted-foreground">
						{#if poll.isOpen}
							Omröstningen är öppen.
						{:else}
							Omröstningen är stängd.
						{/if}
					</p>

					{#if poll.isOpen && !p.me?.absentSince}
						{#if hasVoted && !isChangingVote}
							<p class="text-sm text-muted-foreground">
								Du har röstat ({p.myPollVoteOptionIndexes.length}/{poll.maxVotesPerVoter}).
							</p>
							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									disabled={isSubmittingVote || p.actionBusy}
									onclick={enterChangeVote}
								>
									Ändra röst
								</Button>
								<Button
									variant="ghost"
									disabled={isSubmittingVote || p.actionBusy}
									onclick={retractVote}
								>
									Återkalla röst
								</Button>
							</div>
						{:else}
							<Field.Set>
								<Field.Legend>Välj alternativ</Field.Legend>
								<Field.Description>
									{isMultiWinner
										? `Välj upp till ${poll.maxVotesPerVoter} alternativ.`
										: 'Välj ett alternativ.'}
								</Field.Description>
								<Field.Content>
									{#if isMultiWinner}
										<div class="flex flex-col gap-2">
											{#each poll.options as option, optionIndex (optionIndex)}
												<Field.Label for="poll-{optionIndex}">
													<Field.Field orientation="horizontal">
														<Field.Content>
															<Field.Title>{option}</Field.Title>
														</Field.Content>
														<Checkbox
															checked={selectedOptionIndexes.has(optionIndex)}
															onCheckedChange={(checked) =>
																toggleOption(optionIndex, checked === true)}
															disabled={isOptionDisabled(optionIndex)}
															id="poll-{optionIndex}"
														/>
													</Field.Field>
												</Field.Label>
											{/each}
										</div>
									{:else}
										<RadioGroup.Root
											class="gap-2"
											value={effectiveSelection[0]?.toString() ?? ''}
											onValueChange={(value) => {
												if (value !== undefined && value !== '') {
													toggleOption(Number(value), true);
												}
											}}
										>
											{#each poll.options as option, optionIndex (optionIndex)}
												<Field.Label for="poll-r-{optionIndex}">
													<Field.Field orientation="horizontal">
														<Field.Content>
															<Field.Title>{option}</Field.Title>
														</Field.Content>
														<RadioGroup.Item
															value={optionIndex.toString()}
															id="poll-r-{optionIndex}"
															disabled={isOptionDisabled(optionIndex)}
														/>
													</Field.Field>
												</Field.Label>
											{/each}
										</RadioGroup.Root>
									{/if}
								</Field.Content>
							</Field.Set>
							<Button
								disabled={!canSubmitVote || isSubmittingVote || p.actionBusy}
								onclick={submitVote}
								loading={isSubmittingVote}
							>
								Lägg röst
							</Button>
						{/if}
					{/if}

					{#if !poll.isOpen && poll.isResultPublic}
						<p class="text-sm text-muted-foreground">
							Detaljerade valresultat visas inte i förenklat läge. Använd ordinarie mötesvy om det
							går.
						</p>
					{/if}
				</div>
			{/if}

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
