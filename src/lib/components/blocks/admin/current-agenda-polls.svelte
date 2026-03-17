<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const meeting = getMeetingContext();
	const currentAgendaItem = $derived(meeting.agenda.currentItem ?? null);
	const currentPollId = $derived(meeting.meeting.currentPollId);
	const pollsResult = meeting.adminQuery(api.admin.poll.getPollsByAgendaItemId, () =>
		currentAgendaItem ? { agendaItemId: currentAgendaItem.id } : 'skip',
	);
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
						</div>
						{#if poll.isOpen}
							<Button
								size="sm"
								variant="outline"
								onClickPromise={() =>
									meeting.adminMutate(api.admin.poll.closePollByAdmin, { pollId: poll._id })}
							>
								Stäng
							</Button>
						{:else if poll.closedAt != null}
							<Button
								size="sm"
								onClickPromise={() =>
									meeting.adminMutate(api.admin.poll.showPollResults, { pollId: poll._id })}
								>Visa resultat</Button
							>
							<Button
								size="sm"
								variant="outline"
								onClickPromise={() =>
									meeting.adminMutate(api.admin.poll.duplicatePoll, { pollId: poll._id })}
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
											meeting.adminMutate(api.admin.poll.removePoll, { pollId: poll._id }),
									})}
							>
								<Trash2Icon class="size-4" />
							</Button>
						{:else}
							<Button
								size="sm"
								onClickPromise={() =>
									meeting.adminMutate(api.admin.poll.openPoll, { pollId: poll._id })}>Öppna</Button
							>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
