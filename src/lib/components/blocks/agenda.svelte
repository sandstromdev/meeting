<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { getMeetingContext } from '$lib/context.svelte';

	const meeting = getMeetingContext();
	const agenda = $derived(meeting.meeting.agenda ?? []);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (agenda.length > 0 ? agenda[0].id : undefined),
	);
</script>

<Collapsible class="rounded-lg border">
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
	>
		<h2 class="font-semibold">Dagordning</h2>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>

	<CollapsibleContent>
		<div class="space-y-2 border-t p-3">
			{#if agenda.length === 0}
				<p class="text-sm text-muted-foreground">Inga agendapunkter ännu.</p>
			{:else}
				{#each agenda as item}
					<article class="rounded-md border p-3">
						<div class="flex items-center justify-between gap-2">
							<h3 class="font-medium">{item.number}. {item.title}</h3>
							{#if item.id === currentAgendaItemId}
								<span class="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
									Aktuell
								</span>
							{/if}
						</div>

						{#if item.poll}
							<div class="mt-2 text-xs text-muted-foreground">
								<p>
									{item.poll.isOpen ? 'Omröstning öppen' : 'Omröstning stängd'} - Röster:
									{item.poll.votesCount}/{item.poll.eligibleVoters}
								</p>
							</div>
						{/if}
					</article>
				{/each}
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
