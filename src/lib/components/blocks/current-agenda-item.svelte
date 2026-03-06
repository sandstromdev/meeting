<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { getMeetingContext } from '$lib/context.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { usePageState } from '$lib/page-state.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';

	let { showNext = true }: { showNext?: boolean } = $props();

	const meeting = getMeetingContext();
	const ps = usePageState();
	const ag = meeting.agenda;
</script>

<section class="flex gap-2 rounded-lg border px-4 py-3">
	<div>
		<h2 class="text-sm font-semibold text-muted-foreground">Aktuell punkt</h2>

		{#if ag.currentItem}
			<div class="mt-2 space-y-1">
				<h3 class={cn('text-lg font-semibold', ps.isProjector && 'text-2xl')}>
					{ag.currentItem.number}. {ag.currentItem.title}
				</h3>
				{#if !ps.isProjector && ag.currentItem.polls?.length}
					<div class="mt-2 space-y-3">
						{#each ag.currentItem.polls as poll, i (poll.id)}
							<div class="rounded-md border bg-muted/30 p-2 text-sm">
								<p class="font-medium">{i + 1}. {poll.title}</p>
								<p class="text-muted-foreground">
									{poll.isOpen ? 'Hemlig omröstning pågår.' : 'Omröstning stängd.'}
									Röstande: {poll.votersCount}/{poll.eligibleVoters}. Röster: {poll.votesCount}
								</p>
								{#if poll.isOpen}
									<p class="text-xs text-muted-foreground">
										{#if poll.hasVoted}
											Du har röstat ({poll.myVoteOptionIndexes.length}/{poll.maxVotesPerVoter}).
										{:else}
											Du kan välja upp till {poll.maxVotesPerVoter} alternativ.
										{/if}
									</p>
									{#if !ps.isProjector}
										{#if poll.hasVoted}
											<p class="mt-1 text-xs text-muted-foreground">
												Dina röster: {poll.myVoteOptionIndexes
													.map((i) => poll.options[i])
													.join(', ')}
											</p>
										{:else}
											<div class="mt-2 space-y-2">
												{#each poll.options as option, optionIndex (optionIndex)}
													<label class="flex items-center gap-2 text-xs text-muted-foreground">
														<input
															type="checkbox"
															checked={ag.isOptionSelected(poll.id, optionIndex)}
															onchange={() => ag.toggleOption(poll, optionIndex)}
														/>
														<span>{option}</span>
													</label>
												{/each}
												<div class="flex items-center gap-2">
													<Button
														size="sm"
														variant="outline"
														onClickPromise={() => ag.submitVote(poll)}
														disabled={ag.selectedForPoll(poll.id).length === 0}
													>
														Rösta
													</Button>
													<span class="text-xs text-muted-foreground">
														Valt {ag.selectedForPoll(poll.id).length} av {poll.maxVotesPerVoter}
													</span>
												</div>
											</div>
										{/if}
									{/if}
								{:else if poll.optionTotals && !ps.isProjector}
									{#if poll.winnerOptionIndexes?.length !== undefined}
										<p class="mt-1 text-xs font-medium text-foreground">
											{#if poll.winnerOptionIndexes.length === 0}
												Ingen vinnare (ingen nådde majoriteten).
											{:else if poll.isTie}
												Oavgjort: {poll.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
											{:else if poll.winnerOptionIndexes.length === 1}
												Vinnare: {poll.options[poll.winnerOptionIndexes[0]]}
											{:else}
												Vinnare: {poll.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
											{/if}
										</p>
									{/if}
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
			{#if showNext && ag.nextItem}
				<div class={cn('mt-2 text-sm text-muted-foreground', ps.isProjector && 'text-lg')}>
					<p>Nästa punkt: {ag.nextItem.number}. {ag.nextItem.title}</p>
				</div>
			{/if}
		{:else}
			<p class="mt-2 text-sm text-muted-foreground">Ingen aktuell punkt vald.</p>
		{/if}
	</div>

	{#if meeting.isAdmin && !ps.isProjector}
		<div class="ml-auto flex flex-col gap-2">
			<Button
				size="icon"
				variant="ghost"
				type="button"
				disabled={!ag.previousItem}
				onClickPromise={() => meeting.adminMutate(api.admin.agenda.previous)}
			>
				<ChevronUpIcon class="size-4" />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				type="button"
				disabled={!ag.nextItem}
				onClickPromise={() => meeting.adminMutate(api.admin.agenda.next)}
			>
				<ChevronDownIcon class="size-4" />
			</Button>
		</div>
	{/if}
</section>
