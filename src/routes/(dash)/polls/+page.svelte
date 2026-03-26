<script lang="ts">
	import { resolve } from '$app/paths';
	import { PUBLIC_SITE_URL } from '$env/static/public';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { ABSTAIN_OPTION_LABEL } from '$lib/polls';
	import type { PollDraft, UserPollVisibility } from '$lib/validation';
	import CreatePoll from './create-poll.svelte';
	import { toast } from 'svelte-sonner';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	function participantPollUrl(code: string): string {
		const base = PUBLIC_SITE_URL.replace(/\/$/, '');
		return `${base}${resolve(`/p/${code}`)}`;
	}

	function userPollRowToDraft(poll: Doc<'userPolls'>): PollDraft {
		const options = poll.options.filter((o) => o !== ABSTAIN_OPTION_LABEL);
		return {
			title: poll.title,
			options: options.length >= 1 ? options : ['', ''],
			type: poll.type,
			winningCount: poll.winningCount ?? 1,
			majorityRule: poll.majorityRule ?? 'simple',
			isResultPublic: poll.isResultPublic,
			allowsAbstain: poll.allowsAbstain,
			maxVotesPerVoter: poll.maxVotesPerVoter,
		};
	}

	let { data } = $props();

	const convex = useConvexClient();
	const standaloneApi = api.userPoll.public;
	const standaloneAdminApi = api.userPoll.admin;
	const ownedPolls = useQuery(standaloneApi.getMyOwnedPolls);

	let resultsDialogOpen = $state(false);
	let resultsDialogPollId = $state<Id<'userPolls'> | null>(null);
	let resultsDialogPollTitle = $state('');

	let editDialogOpen = $state(false);
	let editDialogPoll = $state<Doc<'userPolls'> | null>(null);

	const resultsSnapshot = useQuery(standaloneAdminApi.getMyPollResultsSnapshot, () =>
		resultsDialogOpen && resultsDialogPollId ? { pollId: resultsDialogPollId } : 'skip',
	);

	let actionLoadingPollId = $state<string | null>(null);
	let actionLoadingType = $state<string | null>(null);

	function openResultsDialog(pollId: Id<'userPolls'>, title: string) {
		resultsDialogPollId = pollId;
		resultsDialogPollTitle = title;
		resultsDialogOpen = true;
	}

	function openEditDialog(poll: Doc<'userPolls'>) {
		editDialogPoll = poll;
		editDialogOpen = true;
	}

	async function submitPollEdit(payload: {
		draft: PollDraft;
		visibilityMode?: UserPollVisibility;
	}) {
		const row = editDialogPoll;
		if (!row) {
			return;
		}
		try {
			await convex.mutation(standaloneAdminApi.editPoll, {
				pollId: row._id,
				edits: {
					title: payload.draft.title,
					options: payload.draft.options,
					type: payload.draft.type,
					winningCount: payload.draft.winningCount,
					majorityRule: payload.draft.majorityRule,
					maxVotesPerVoter: payload.draft.maxVotesPerVoter,
					allowsAbstain: payload.draft.allowsAbstain,
					isResultPublic: payload.draft.isResultPublic,
					visibilityMode: payload.visibilityMode ?? row.visibilityMode,
				},
			});
			toast.success('Omröstningen uppdaterades.');
			editDialogOpen = false;
			editDialogPoll = null;
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte spara ändringar.');
		}
	}

	const user = $derived(data.currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');

	async function withPollAction(
		pollId: string,
		action: 'open' | 'close' | 'cancel' | 'remove' | 'duplicate',
		fn: () => Promise<unknown>,
		successMessage: string,
	) {
		if (actionLoadingPollId) {
			return;
		}
		actionLoadingPollId = pollId;
		actionLoadingType = action;
		try {
			await fn();
			toast.success(successMessage);
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte uppdatera omröstningen.');
		} finally {
			actionLoadingPollId = null;
			actionLoadingType = null;
		}
	}
</script>

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
						{#if resultsSnapshot.isLoading}
							<p class="text-sm text-muted-foreground">Laddar resultat...</p>
						{:else if !resultsSnapshot.data}
							<Alert.Root variant="destructive">
								<Alert.Description>Kunde inte läsa resultat.</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.data.kind === 'open'}
							<Alert.Root variant="warning">
								<Alert.Description>Omröstningen är fortfarande öppen.</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.data.kind === 'cancelled'}
							<Alert.Root variant="warning">
								<Alert.Description>
									Omröstningen avbröts utan att stängas – inga sparade resultat finns.
								</Alert.Description>
							</Alert.Root>
						{:else if resultsSnapshot.data.kind === 'pending'}
							<Alert.Root variant="warning">
								<Alert.Description>
									Resultat beräknas. Uppdatera om ett ögonblick.
								</Alert.Description>
							</Alert.Root>
						{:else}
							<PollResultsDisplay
								data={{
									complete: resultsSnapshot.data.complete,
									results: resultsSnapshot.data.results,
								}}
								showDetailedResults
							/>
						{/if}
					</div>
				{/key}
			</Dialog.Content>
		</Dialog.Root>

		<Dialog.Root
			bind:open={editDialogOpen}
			onOpenChange={(open) => {
				if (!open) {
					editDialogPoll = null;
				}
			}}
		>
			<Dialog.Content class="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl">
				{#key editDialogPoll?._id}
					{#if editDialogPoll}
						<EditPoll
							poll={userPollRowToDraft(editDialogPoll)}
							isStandalone
							visibilityMode={editDialogPoll.visibilityMode}
							title="Redigera omröstning"
							titlePlaceholder="Till exempel: Val av mötesordförande"
							submitLabel="Spara"
							submitPendingLabel="Sparar..."
							showDiscard
							onDiscard={() => {
								editDialogOpen = false;
								editDialogPoll = null;
							}}
							onSubmit={submitPollEdit}
						/>
					{/if}
				{/key}
			</Dialog.Content>
		</Dialog.Root>

		<section class="rounded-md border p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-medium">Mina omröstningar</h2>
			<div class="flex flex-col gap-3">
				{#if ownedPolls.isLoading}
					<p class="text-sm text-muted-foreground">Laddar omröstningar...</p>
				{:else if !ownedPolls.data?.length}
					<p class="text-sm text-muted-foreground">Du har inga fristående omröstningar ännu.</p>
				{:else}
					{#each ownedPolls.data as poll (poll._id)}
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
										{poll.isOpen ? ' — Öppen' : ' — Stängd'}
									</p>
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
													() =>
														convex.mutation(standaloneAdminApi.closePoll, {
															pollId: poll._id,
														}),
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
													() =>
														convex.mutation(standaloneAdminApi.cancelPoll, {
															pollId: poll._id,
														}),
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
													() =>
														convex.mutation(standaloneAdminApi.openPoll, {
															pollId: poll._id,
														}),
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
														() =>
															convex.mutation(standaloneAdminApi.duplicatePoll, {
																pollId: poll._id,
															}),
														'En kopia skapades.',
													)}
											>
												<CopyIcon class="size-4" />
												Duplicera
											</DropdownMenu.Item>
											{#if !poll.isOpen}
												<DropdownMenu.Separator />
												<DropdownMenu.Item
													variant="destructive"
													disabled={actionLoadingPollId === poll._id}
													onclick={() =>
														withPollAction(
															poll._id,
															'remove',
															() =>
																convex.mutation(standaloneAdminApi.removePoll, {
																	pollId: poll._id,
																}),
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
					{/each}
				{/if}
			</div>
		</section>

		<CreatePoll />
	{/if}
</div>
