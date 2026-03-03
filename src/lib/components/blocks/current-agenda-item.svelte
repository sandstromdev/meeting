<script lang="ts">
	import { getMeetingContext } from '$lib/context.svelte';
	import { cn } from '$lib/utils';
	import { usePageState } from '$lib/page-state.svelte';

	let { showNext = true }: { showNext?: boolean } = $props();

	const meeting = getMeetingContext();
	const ps = usePageState();

	const agenda = $derived(meeting.meeting.agenda ?? []);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (agenda.length > 0 ? agenda[0].id : undefined),
	);

	const currentItem = $derived(agenda.find((item) => item.id === currentAgendaItemId));
	const nextItem = $derived(agenda.find((item) => item.number > (currentItem?.number ?? 0)));
</script>

<section class="rounded-lg border px-4 py-3">
	<h2 class="text-sm font-semibold text-muted-foreground">Aktuell punkt</h2>

	{#if currentItem}
		<div class="mt-2 space-y-1">
			<h3 class={cn('text-lg font-semibold', ps.isProjector && 'text-2xl')}>
				{currentItem.number}. {currentItem.title}
			</h3>

			{#if currentItem.polls?.length}
				<div class="mt-2 space-y-3">
					{#each currentItem.polls as poll, i (poll.id)}
						<div class="rounded-md border bg-muted/30 p-2 text-sm">
							<p class="font-medium">{i + 1}. {poll.title}</p>
							<p class="text-muted-foreground">
								{poll.isOpen ? 'Hemlig omröstning pågår.' : 'Omröstning stängd.'}
								Röster: {poll.votesCount}/{poll.eligibleVoters}
							</p>
							{#if poll.isOpen}
								<p class="text-xs text-muted-foreground">
									{poll.hasVoted ? 'Du har röstat.' : 'Du har inte röstat ännu.'}
								</p>
							{:else if poll.optionTotals && !ps.isProjector}
								<ul class="mt-1 space-y-1 text-xs text-muted-foreground">
									{#each poll.optionTotals as option (option.optionIndex)}
										<li>
											{option.option}: {option.votes} ({(
												(option.votes / (poll.votesCount || 1)) *
												100
											).toFixed(1)}%)
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if showNext && nextItem}
			<div class={cn('mt-2 text-sm text-muted-foreground', ps.isProjector && 'text-lg')}>
				<p>Nästa punkt: {nextItem.number}. {nextItem.title}</p>
			</div>
		{/if}
	{:else}
		<p class="mt-2 text-sm text-muted-foreground">Ingen aktuell punkt vald.</p>
	{/if}
</section>
