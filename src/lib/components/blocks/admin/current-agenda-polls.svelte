<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc } from '$convex/_generated/dataModel';
	import { hydratePollRowToDraft } from '$lib/components/blocks/admin/agenda/agenda';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import { notifyMutation } from '$lib/admin-toast';
	import { getMeetingContext } from '$lib/context.svelte';
	import { ABSTAIN_OPTION_LABEL, getVoteShare } from '$lib/polls';
	import type { PollDraft } from '$lib/validation';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const meeting = getMeetingContext();

	let editDialogOpen = $state(false);
	let editDialogPoll = $state<Doc<'meetingPolls'> | null>(null);

	function openEditPollDialog(poll: Doc<'meetingPolls'>) {
		editDialogPoll = poll;
		editDialogOpen = true;
	}

	async function submitMeetingPollEdit(payload: { draft: PollDraft }) {
		const row = editDialogPoll;
		if (!row) {
			return;
		}
		try {
			await notifyMutation(
				'Omröstningen uppdaterades.',
				() =>
					meeting.adminMutate(api.meeting.admin.meetingPoll.editPoll, {
						pollId: row._id,
						edits: payload.draft,
					}),
				{ rethrow: true },
			);
			editDialogOpen = false;
			editDialogPoll = null;
		} catch {
			// Toast shown by notifyMutation
		}
	}
	const currentAgendaItem = $derived(meeting.agenda.currentItem ?? null);
	const currentPollId = $derived(meeting.meeting.currentPollId);
	const pollsResult = meeting.adminQuery(
		api.meeting.admin.meetingPoll.getPollsByAgendaItemId,
		() => (currentAgendaItem ? { agendaItemId: currentAgendaItem.id } : 'skip'),
	);

	function isWinningOption(
		winners: {
			optionIndex: number;
		}[],
		optionIndex: number,
	) {
		return winners.some((winner) => winner.optionIndex === optionIndex);
	}
</script>

<section class="rounded-lg border p-4">
	<h2 class="text-sm font-semibold text-muted-foreground">Aktiva omröstningar (admin)</h2>

	{#if !currentAgendaItem}
		<p class="mt-2 text-sm text-muted-foreground">Ingen aktuell punkt vald.</p>
	{:else if !pollsResult.data}
		<p class="mt-2 text-sm text-muted-foreground">Laddar omröstningar...</p>
	{:else if pollsResult.data.length === 0}
		<p class="mt-2 text-sm text-muted-foreground">Inga omröstningar kopplade till aktuell punkt.</p>
	{:else}
		<div class="mt-3 space-y-2">
			{#each pollsResult.data as poll, i (poll._id)}
				<div class="rounded-md border p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1">
							<p class="text-sm font-medium">{i + 1}. {poll.title}</p>
							<p class="text-xs text-muted-foreground">
								{poll.isOpen ? 'Öppnad' : 'Stängd'}
								{#if currentPollId === poll._id}
									- Visas nu
								{/if}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Röstande: {poll.votersCount}/{poll.eligibleVoters}. Röster: {poll.votesCount}.
							</p>
						</div>
						<div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
							{#if poll.isOpen}
								<Button
									size="sm"
									variant="outline"
									onClickPromise={() =>
										notifyMutation('Omröstning stängd.', () =>
											meeting.adminMutate(api.meeting.admin.meetingPoll.closePollByAdmin, {
												pollId: poll._id,
											}),
										)}
								>
									Stäng
								</Button>
							{:else if poll.closedAt != null}
								<Button size="sm" variant="outline" onclick={() => openEditPollDialog(poll)}>
									<PencilIcon class="size-4" />
									Redigera
								</Button>
								<Button
									size="sm"
									onClickPromise={() =>
										notifyMutation('Resultat visas för deltagare.', () =>
											meeting.adminMutate(api.meeting.admin.meetingPoll.showPollResults, {
												pollId: poll._id,
											}),
										)}>Visa resultat</Button
								>
								<Button
									size="sm"
									variant="outline"
									onClickPromise={() =>
										notifyMutation('Omröstning duplicerad.', () =>
											meeting.adminMutate(api.meeting.admin.meetingPoll.duplicatePoll, {
												pollId: poll._id,
											}),
										)}
								>
									Duplicera
								</Button>
								<Button
									size="icon-sm"
									variant="destructive"
									onclick={() =>
										confirm({
											title: 'Ta bort omröstning?',
											description: 'Är du säker på att du vill ta bort denna omröstning?',
											onConfirm: () =>
												notifyMutation(
													'Omröstning borttagen.',
													() =>
														meeting.adminMutate(api.meeting.admin.meetingPoll.removePoll, {
															pollId: poll._id,
														}),
													{ rethrow: true },
												),
										})}
								>
									<Trash2Icon class="size-4" />
								</Button>
							{:else}
								<Button
									size="sm"
									onClickPromise={() =>
										notifyMutation('Omröstning öppnad.', () =>
											meeting.adminMutate(api.meeting.admin.meetingPoll.openPoll, {
												pollId: poll._id,
											}),
										)}>Öppna</Button
								>
							{/if}
						</div>
					</div>

					{#if poll.closedAt != null && poll.results}
						<div class="mt-3 space-y-2">
							<p class="text-xs font-medium text-muted-foreground">
								{#if poll.results.winners.length === 0}
									Ingen vinnare.
								{:else if poll.results.isTie}
									Oavgjort mellan {poll.results.winners.length} alternativ.
								{:else}
									{poll.results.winners.length} vinnande alternativ.
								{/if}
							</p>
							<div class="grid gap-2 md:grid-cols-2">
								{#each poll.results.optionTotals as option (option.optionIndex)}
									<div
										class={`rounded-md border p-3 ${
											isWinningOption(poll.results.winners, option.optionIndex)
												? 'border-primary bg-primary/5'
												: 'bg-background'
										}`}
									>
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<p class="text-sm font-medium">{option.option}</p>
												<p class="text-xs text-muted-foreground">
													{option.votes} röster •
													{getVoteShare(
														option.votes,
														option.option === ABSTAIN_OPTION_LABEL
															? poll.results.counts.totalVotes
															: poll.results.counts.usableVotes,
													)}%
												</p>
											</div>
											{#if isWinningOption(poll.results.winners, option.optionIndex)}
												<span class="text-xs font-medium text-primary">Vinnare</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
							<p class="text-xs text-muted-foreground">
								Komplett resultat: {poll.complete ? 'ja' : 'nej'}. Avstår: {getVoteShare(
									poll.results.counts.abstain,
									poll.results.counts.totalVotes,
								)}%.
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

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
					poll={hydratePollRowToDraft(editDialogPoll)}
					title="Redigera omröstning"
					submitLabel="Spara ändringar"
					submitPendingLabel="Sparar..."
					showDiscard
					onDiscard={() => {
						editDialogOpen = false;
						editDialogPoll = null;
					}}
					onSubmit={submitMeetingPollEdit}
				/>
			{/if}
		{/key}
	</Dialog.Content>
</Dialog.Root>
