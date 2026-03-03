<script lang="ts">
	import { getMeetingContext } from '$lib/context.svelte';

	const meeting = getMeetingContext();
	const agenda = $derived(meeting.meeting.agenda ?? []);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (agenda.length > 0 ? agenda[0].id : undefined),
	);
	const currentItem = $derived(agenda.find((item) => item.id === currentAgendaItemId) ?? null);
</script>

<section class="rounded-lg border px-4 py-3">
	<h2 class="text-sm font-semibold text-muted-foreground">Aktuell punkt</h2>

	{#if currentItem}
		<div class="mt-2 space-y-1">
			<h3 class="text-lg font-semibold">{currentItem.number}. {currentItem.title}</h3>

			{#if currentItem.poll}
				<div class="pt-2 text-sm">
					<p class="font-medium">{currentItem.poll.title}</p>
					<p class="text-muted-foreground">
						{currentItem.poll.isOpen ? 'Hemlig omröstning pågår.' : 'Omröstning stängd.'}
						Röster: {currentItem.poll.votesCount}/{currentItem.poll.eligibleVoters}
					</p>
					{#if currentItem.poll.isOpen}
						<p class="text-xs text-muted-foreground">
							{currentItem.poll.hasVoted ? 'Du har röstat.' : 'Du har inte röstat ännu.'}
						</p>
					{:else if currentItem.poll.optionTotals}
						<ul class="mt-1 space-y-1 text-xs text-muted-foreground">
							{#each currentItem.poll.optionTotals as option}
								<li>{option.option}: {option.votes}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<p class="mt-2 text-sm text-muted-foreground">Ingen aktuell punkt vald.</p>
	{/if}
</section>
