<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/context.svelte';

	const meeting = getMeetingContext();
	const currentAgendaItem = $derived(meeting.agenda.currentItem ?? null);
	const currentPollId = $derived(meeting.meeting.currentPollId);
	const pollsResult = meeting.adminQuery(api.admin.poll.getPollsByAgendaItemId, () =>
		currentAgendaItem ? { agendaItemId: currentAgendaItem.id } : 'skip',
	);

	async function openPoll(pollId: Id<'polls'>) {
		await meeting.adminMutate(api.admin.poll.openPoll, { pollId });
	}

	async function closePoll(pollId: Id<'polls'>) {
		await meeting.adminMutate(api.admin.poll.closePollByAdmin, { pollId });
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
						<div>
							<p class="text-sm font-medium">{i + 1}. {poll.title}</p>
							<p class="text-xs text-muted-foreground">
								{poll.isOpen ? 'Oppnad' : 'Stangd'}
								{#if currentPollId === poll._id}
									- Visas nu
								{/if}
							</p>
						</div>
						{#if poll.isOpen}
							<Button size="sm" variant="outline" onClickPromise={() => closePoll(poll._id)}>
								Stang
							</Button>
						{:else}
							<Button size="sm" onClickPromise={() => openPoll(poll._id)}>Oppna</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
