<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import type { Doc, Id } from '@lsnd-mt/convex/_generated/dataModel';
	import { PUBLIC_SITE_URL } from '$env/static/public';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import Heading from '$lib/components/ui/heading.svelte';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import { hydratePollRowToDraft, type UserPollDraft } from '$lib/polls';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { useInterval } from 'runed';
	import { toast } from 'svelte-sonner';
	import CreatePoll from './create-poll.svelte';
	import EditPollDialog from '$lib/components/ui/edit-poll-dialog.svelte';
	import {
		cancelPoll as cancelPollRemote,
		closePoll as closePollRemote,
		duplicatePoll as duplicatePollRemote,
		editPoll as editPollRemote,
		getPollResultsSnapshot as getPollResultsSnapshotRemote,
		listOwnedPolls as listOwnedPollsRemote,
		openPoll as openPollRemote,
		removePoll as removePollRemote,
		watchOwnedPollMetrics as watchOwnedPollMetricsRemote,
	} from './dashboard.remote';

	type DashboardPoll = Doc<'userPolls'> & {
		votesCount: number | null;
		votersCount: number | null;
	};
	type PollMetrics = Extract<
		Awaited<ReturnType<typeof watchOwnedPollMetricsRemote>>,
		{ ok: true }
	>['metrics'][number];
	type PollResultsSnapshot = Extract<
		Awaited<ReturnType<typeof getPollResultsSnapshotRemote>>,
		{ ok: true }
	>['snapshot'];
	type RemoteMutationResult = Promise<{ ok: true } | { ok: false; error: { message: string } }>;

	const OPEN_POLL_INTERVAL_MS = 5_000;
	const POLLS_REFRESH_INTERVAL_MS = 25_000;
	const RESULTS_PENDING_INTERVAL_MS = 1_500;

	function participantPollUrl(code: string): string {
		const base = PUBLIC_SITE_URL.replace(/\/$/, '');
		return `${base}${resolve(`/p/${code}`)}`;
	}

	function participantPollInfoUrl(code: string): string {
		const base = PUBLIC_SITE_URL.replace(/\/$/, '');
		return `${base}${resolve(`/p/${code}/info`)}`;
	}

	function toDashboardPoll(poll: Doc<'userPolls'>, existing?: DashboardPoll): DashboardPoll {
		return {
			...poll,
			votesCount: existing?.votesCount ?? null,
			votersCount: existing?.votersCount ?? null,
		};
	}

	function mergePolls(
		nextPolls: Doc<'userPolls'>[],
		currentPolls: DashboardPoll[],
	): DashboardPoll[] {
		const currentById = new Map(currentPolls.map((poll) => [poll._id, poll]));
		return nextPolls.map((poll) => toDashboardPoll(poll, currentById.get(poll._id)));
	}

	function mergePollMetrics(
		currentPolls: DashboardPoll[],
		metrics: PollMetrics[],
	): DashboardPoll[] {
		const metricsById = new Map(metrics.map((metric) => [metric.pollId, metric]));

		return currentPolls.map((poll) => {
			const metric = metricsById.get(poll._id);
			if (!metric) {
				return poll;
			}

			return {
				...poll,
				isOpen: metric.isOpen,
				closedAt: metric.closedAt,
				updatedAt: metric.updatedAt,
				votesCount: metric.votesCount,
				votersCount: metric.votersCount,
			};
		});
	}

	let { data } = $props();

	const serverPolls = $derived(mergePolls(data.ownedPolls ?? [], []));

	let localPolls = $state.raw<DashboardPoll[] | null>(null);

	const polls = $derived(localPolls ?? serverPolls);

	let pollsRefreshing = $state(false);
	let pollsError = $state<string | null>(null);

	let resultsDialogOpen = $state(false);
	let resultsDialogPollId = $state<Id<'userPolls'> | null>(null);
	let resultsDialogPollTitle = $state('');
	let resultsSnapshot = $state<PollResultsSnapshot | null>(null);
	let resultsSnapshotLoading = $state(false);
	let resultsSnapshotError = $state<string | null>(null);

	let editDialogPoll = $state<UserPollDraft | null>(null);

	let actionLoadingPollId = $state<string | null>(null);
	let actionLoadingType = $state<string | null>(null);
	let refreshingPolls = false;
	let refreshingMetrics = $state(false);
	let refreshingResults = false;

	const user = $derived(data.currentUser);
	const isAdmin = $derived(user?.role === 'admin');
	const openPollIds = $derived(polls.filter((poll) => poll.isOpen).map((poll) => poll._id));

	const sortedPolls = $derived(polls.toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
	const openPolls = $derived(sortedPolls.filter((poll) => poll.isOpen));
	const closedPolls = $derived(sortedPolls.filter((poll) => !poll.isOpen));

	const OPEN_PAGE_SIZE = 10;
	const CLOSED_PAGE_SIZE = 10;

	let openVisibleCount = $state(OPEN_PAGE_SIZE);
	let closedVisibleCount = $state(CLOSED_PAGE_SIZE);

	const openVisiblePolls = $derived(openPolls.slice(0, openVisibleCount));
	const closedVisiblePolls = $derived(closedPolls.slice(0, closedVisibleCount));

	$effect(() => {
		const minOpen = Math.min(OPEN_PAGE_SIZE, openPolls.length);
		openVisibleCount = Math.min(Math.max(openVisibleCount, minOpen), openPolls.length);
	});

	$effect(() => {
		const minClosed = Math.min(CLOSED_PAGE_SIZE, closedPolls.length);
		closedVisibleCount = Math.min(Math.max(closedVisibleCount, minClosed), closedPolls.length);
	});

	const shouldPollResultsSnapshot = $derived(
		isAdmin &&
			resultsDialogOpen &&
			resultsDialogPollId !== null &&
			resultsSnapshot?.kind === 'pending',
	);

	async function refreshPolls(options: { silent?: boolean } = {}) {
		if (!browser || !isAdmin || refreshingPolls) {
			return;
		}

		refreshingPolls = true;
		pollsRefreshing = true;

		try {
			const result = await listOwnedPollsRemote().run();

			if (!result.ok) {
				pollsError = result.error.message;
				if (!options.silent) {
					toast.error(result.error.message);
				}
				return;
			}

			localPolls = mergePolls(result.polls, polls);
			pollsError = null;
		} finally {
			pollsRefreshing = false;
			refreshingPolls = false;
		}
	}

	async function refreshOpenPollMetrics(options: { silent?: boolean } = {}) {
		if (!browser || !isAdmin || refreshingMetrics || openPollIds.length === 0) {
			return;
		}

		refreshingMetrics = true;

		try {
			const result = await watchOwnedPollMetricsRemote({ pollIds: openPollIds }).run();

			if (!result.ok) {
				if (!options.silent) {
					toast.error(result.error.message);
				}
				return;
			}

			localPolls = mergePollMetrics(polls, result.metrics);
			pollsError = null;
		} finally {
			refreshingMetrics = false;
		}
	}

	async function refreshResultsSnapshot(options: { silent?: boolean } = {}) {
		if (!browser || !isAdmin || !resultsDialogPollId || refreshingResults) {
			return;
		}

		refreshingResults = true;
		resultsSnapshotLoading = true;

		try {
			const pollId = resultsDialogPollId;
			const result = await getPollResultsSnapshotRemote({ pollId }).run();

			if (!result.ok) {
				resultsSnapshotError = result.error.message;
				if (!options.silent) {
					toast.error(result.error.message);
				}
				return;
			}

			resultsSnapshot = result.snapshot;
			resultsSnapshotError = null;
		} finally {
			resultsSnapshotLoading = false;
			refreshingResults = false;
		}
	}

	function openResultsDialog(pollId: Id<'userPolls'>, title: string) {
		resultsDialogPollId = pollId;
		resultsDialogPollTitle = title;
		resultsSnapshot = null;
		resultsSnapshotError = null;
		resultsDialogOpen = true;
		void refreshResultsSnapshot({ silent: true });
	}

	function openEditDialog(poll: Doc<'userPolls'>) {
		editDialogPoll = hydratePollRowToDraft(poll) as UserPollDraft;
	}

	async function refreshDashboardState() {
		await refreshPolls({ silent: true });
		await refreshOpenPollMetrics({ silent: true });
	}

	async function handlePollCreated() {
		await refreshDashboardState();
	}

	async function submitPollEdit(draft: UserPollDraft) {
		const { id, ...edits } = draft;

		if (!id) {
			toast.error('Kunde inte spara ändringar.');
			return;
		}

		const result = await editPollRemote({
			pollId: id,
			edits,
		});

		if (!result.ok) {
			toast.error(result.error.message);
			return;
		}

		editDialogPoll = null;
		toast.success('Omröstningen uppdaterades.');
		await refreshDashboardState();
	}

	async function withPollAction(
		pollId: string,
		action: 'open' | 'close' | 'cancel' | 'remove' | 'duplicate',
		fn: () => RemoteMutationResult,
		successMessage: string,
	) {
		if (actionLoadingPollId) {
			return;
		}
		actionLoadingPollId = pollId;
		actionLoadingType = action;
		try {
			const result = await fn();
			if (!result.ok) {
				toast.error(result.error.message);
				return;
			}
			toast.success(successMessage);
			await refreshDashboardState();
		} finally {
			actionLoadingPollId = null;
			actionLoadingType = null;
		}
	}

	const pollsListInterval = useInterval(POLLS_REFRESH_INTERVAL_MS, {
		immediate: false,
		callback: async () => {
			if (!isAdmin || openPollIds.length > 0) {
				return;
			}

			await refreshPolls({ silent: true });
		},
	});

	const openPollMetricsInterval = useInterval(OPEN_POLL_INTERVAL_MS, {
		immediate: false,
		callback: async () => {
			if (!isAdmin || openPollIds.length === 0) {
				return;
			}

			await refreshOpenPollMetrics({ silent: true });
		},
	});

	const resultsPendingInterval = useInterval(RESULTS_PENDING_INTERVAL_MS, {
		immediate: false,
		callback: async () => {
			if (!shouldPollResultsSnapshot) {
				return;
			}

			await refreshResultsSnapshot({ silent: true });
		},
	});

	$effect(() => {
		if (!browser) {
			return;
		}
		pollsListInterval.resume();
		openPollMetricsInterval.resume();
		resultsPendingInterval.resume();
		return () => {
			pollsListInterval.pause();
			openPollMetricsInterval.pause();
			resultsPendingInterval.pause();
		};
	});
</script>

<SeoHead
	title="Fristående omröstningar"
	description="Skapa och dela omröstningar som deltagare kan rösta på via länk."
/>
<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold">Fristående omröstningar</h1>

	{#if user === null}
		<Alert.Root>
			<Alert.Description>
				Du behöver vara inloggad för att skapa och hantera fristående omröstningar.
				<Button
					variant="link"
					class="inline-flex h-auto p-0 align-baseline"
					href={resolve(`/sign-in?redirect=${encodeURIComponent('/polls')}`)}
				>
					Logga in
				</Button>.
			</Alert.Description>
		</Alert.Root>
	{:else if !isAdmin}
		<Alert.Root>
			<Alert.Description>
				Endast administratörer kan skapa och hantera fristående omröstningar.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<Dialog.Root
			bind:open={resultsDialogOpen}
			onOpenChange={(open) => {
				if (!open) {
					resultsDialogPollId = null;
					resultsDialogPollTitle = '';
					resultsSnapshot = null;
					resultsSnapshotError = null;
				}
			}}
		>
			<Dialog.Content class="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
				<Dialog.Header>
					<Dialog.Title>
						{resultsDialogPollTitle ? `Resultat – ${resultsDialogPollTitle}` : 'Resultat'}
					</Dialog.Title>
					<Dialog.Description>
						Sammanfattning från senast sparade resultat när omröstningen stängdes.
					</Dialog.Description>
				</Dialog.Header>

				{#key resultsDialogPollId}
					<div class="space-y-4">
						{#if resultsSnapshotLoading}
							<p class="text-sm text-muted-foreground">Laddar resultat...</p>
						{:else if resultsSnapshotError}
							<Alert.Root variant="destructive">
								<Alert.Description>{resultsSnapshotError}</Alert.Description>
							</Alert.Root>
						{:else if !resultsSnapshot}
							<Alert.Root variant="destructive">
								<Alert.Description>Kunde inte läsa resultat.</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.kind === 'open'}
							<Alert.Root variant="warning">
								<Alert.Description>Omröstningen är fortfarande öppen.</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.kind === 'cancelled'}
							<Alert.Root variant="warning">
								<Alert.Description>
									Omröstningen avbröts utan att stängas – inga sparade resultat finns.
								</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.kind === 'pending'}
							<Alert.Root variant="warning">
								<Alert.Description>
									Resultat beräknas. Uppdatera om ett ögonblick.
								</Alert.Description>
							</Alert.Root>
						{:else}
							<PollResultsDisplay
								data={{
									complete: resultsSnapshot.complete,
									results: resultsSnapshot.results,
								}}
								resultVisibility="full"
							/>
						{/if}
					</div>
				{/key}
			</Dialog.Content>
		</Dialog.Root>

		<section class="rounded-md border p-4 sm:p-5">
			<div class="flex items-center justify-between gap-3">
				<Heading>Mina omröstningar</Heading>
				{#if pollsRefreshing || refreshingMetrics}
					<p class="text-sm text-muted-foreground">Uppdaterar...</p>
				{/if}
			</div>
			<div class="flex flex-col gap-3">
				{#if pollsError}
					<Alert.Root variant="destructive">
						<Alert.Description>{pollsError}</Alert.Description>
					</Alert.Root>
				{/if}
				{#if !polls.length}
					<p class="text-sm text-muted-foreground">Du har inga fristående omröstningar ännu.</p>
				{:else}
					{#snippet pollRow(poll: DashboardPoll)}
						<article class="rounded-md border p-3">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0 flex-1 space-y-1">
									<h3 class="truncate font-medium">{poll.title}</h3>
									<p class="text-sm text-muted-foreground">
										Kod:
										<Button
											variant="link"
											class="inline-flex h-auto p-0 align-baseline font-mono text-inherit"
											href={resolve(`/p/${poll.code}`)}
										>
											{poll.code}
										</Button>
										{#if poll.infoPageEnabled}
											·
											<Button
												variant="link"
												class="inline-flex h-auto p-0 align-baseline text-inherit"
												href={resolve(`/p/${poll.code}/info`)}
											>
												Infosida
											</Button>
										{/if}
										{poll.isOpen ? ' — Öppen' : ' — Stängd'}
									</p>
									{#if poll.votesCount !== null && poll.votersCount !== null}
										<p class="text-sm text-muted-foreground">
											{poll.votesCount} röster från {poll.votersCount} röstande
										</p>
									{/if}
								</div>
								<div class="flex flex-wrap gap-2">
									{#if poll.isOpen}
										<Button
											type="button"
											size="sm"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'close',
													async () => await closePollRemote({ pollId: poll._id }),
													'Omröstningen stängdes.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'close'
												? 'Stänger...'
												: 'Stäng'}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'cancel',
													async () => await cancelPollRemote({ pollId: poll._id }),
													'Omröstningen avbröts.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'cancel'
												? 'Avbryter...'
												: 'Avbryt'}
										</Button>
									{:else}
										<Button
											type="button"
											size="sm"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'open',
													async () => await openPollRemote({ pollId: poll._id }),
													'Omröstningen öppnades.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'open'
												? 'Öppnar...'
												: 'Öppna'}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={actionLoadingPollId === poll._id}
											onclick={() => openResultsDialog(poll._id, poll.title)}
										>
											Visa resultat
										</Button>
									{/if}
									<CopyButton
										text={participantPollUrl(poll.code)}
										variant="outline"
										size="icon-sm"
										title="Kopiera delningslänk"
									/>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<Button
													type="button"
													variant="outline"
													size="icon-sm"
													disabled={actionLoadingPollId === poll._id}
													{...props}
												>
													<EllipsisVerticalIcon class="size-4" />
													<span class="sr-only">Fler åtgärder</span>
												</Button>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" class="w-48">
											<DropdownMenu.Item
												disabled={poll.isOpen || actionLoadingPollId === poll._id}
												onclick={() => openEditDialog(poll)}
											>
												<PencilIcon class="size-4" />
												Redigera
											</DropdownMenu.Item>
											<DropdownMenu.Item
												disabled={actionLoadingPollId === poll._id}
												onclick={() =>
													withPollAction(
														poll._id,
														'duplicate',
														async () => await duplicatePollRemote({ pollId: poll._id }),
														'En kopia skapades.',
													)}
											>
												<CopyIcon class="size-4" />
												Duplicera
											</DropdownMenu.Item>
											{#if poll.infoPageEnabled}
												<DropdownMenu.Item
													disabled={actionLoadingPollId === poll._id}
													onclick={() =>
														window.open(
															participantPollInfoUrl(poll.code),
															'_blank',
															'noopener,noreferrer',
														)}
												>
													<ExternalLinkIcon class="size-4" />
													Öppna infosida
												</DropdownMenu.Item>
											{/if}
											{#if !poll.isOpen}
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													variant="destructive"
													disabled={actionLoadingPollId === poll._id}
													onclick={() =>
														withPollAction(
															poll._id,
															'remove',
															async () => await removePollRemote({ pollId: poll._id }),
															'Omröstningen togs bort.',
														)}
												>
													<Trash2Icon class="size-4" />
													Ta bort
												</DropdownMenu.Item>
											{/if}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>
						</article>
					{/snippet}

					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<Heading>Öppna omröstningar</Heading>
							{#if openPolls.length > openVisiblePolls.length}
								<p class="text-sm text-muted-foreground">
									Visar {openVisiblePolls.length} av {openPolls.length}
								</p>
							{/if}
						</div>

						{#if !openPolls.length}
							<p class="text-sm text-muted-foreground">Du har inga öppna omröstningar.</p>
						{:else}
							<div class="space-y-3">
								{#each openVisiblePolls as poll (poll._id)}
									{@render pollRow(poll)}
								{/each}
							</div>
							{#if openPolls.length > openVisiblePolls.length}
								<div class="pt-1">
									<Button
										type="button"
										variant="outline"
										onclick={() => {
											openVisibleCount = Math.min(
												openVisibleCount + OPEN_PAGE_SIZE,
												openPolls.length,
											);
										}}
									>
										Visa fler
									</Button>
								</div>
							{/if}
						{/if}
					</div>

					<div class="space-y-2 pt-3">
						<div class="flex items-center justify-between gap-2">
							<Heading>Stängda omröstningar</Heading>
							{#if closedPolls.length > closedVisiblePolls.length}
								<p class="text-sm text-muted-foreground">
									Visar {closedVisiblePolls.length} av {closedPolls.length}
								</p>
							{/if}
						</div>

						{#if !closedPolls.length}
							<p class="text-sm text-muted-foreground">Du har inga stängda omröstningar.</p>
						{:else}
							<div class="space-y-3">
								{#each closedVisiblePolls as poll (poll._id)}
									{@render pollRow(poll)}
								{/each}
							</div>
							{#if closedPolls.length > closedVisiblePolls.length}
								<div class="pt-1">
									<Button
										type="button"
										variant="outline"
										onclick={() => {
											closedVisibleCount = Math.min(
												closedVisibleCount + CLOSED_PAGE_SIZE,
												closedPolls.length,
											);
										}}
									>
										Visa fler
									</Button>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</section>

		<section class="space-y-4 rounded-md border p-4 sm:p-6">
			<Heading>Skapa omröstning</Heading>
			<CreatePoll onCreated={handlePollCreated} />
		</section>
	{/if}
</div>

<EditPollDialog
	bind:poll={editDialogPoll}
	onSubmit={async (d) => submitPollEdit(d as UserPollDraft)}
	onDiscard={() => {
		editDialogPoll = null;
	}}
	isStandalone
	titlePlaceholder="Till exempel: Val av mötesordförande"
	submitLabel="Spara"
	submitPendingLabel="Sparar..."
	dialogTitle="Redigera omröstning"
	dialogDescription="Redigera omröstningen för att ändra titel, alternativ eller röstningsregler."
	showDiscard
/>
