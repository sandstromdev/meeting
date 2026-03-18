<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { OptionTotal } from '$convex/helpers/poll';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { ABSTAIN_OPTION_LABEL, getVoteShare } from '$lib/polls';
	import { cn } from '$lib/utils';
	import type { FunctionReturnType } from 'convex/server';

	type Poll = NonNullable<FunctionReturnType<typeof api.users.poll.getCurrentPoll>>;

	const { pollId }: { pollId: Id<'polls'> } = $props();

	const meeting = getMeetingContext();

	const pollResults = meeting.query(api.users.poll.getPollResultsById, () => ({ pollId }));

	const results = $derived(pollResults.data ?? null);

	const winners = $derived(results?.results.winners ?? []);

	const optionTotals = $derived(
		(results?.results.optionTotals ?? []).filter(
			(option) => option.option !== ABSTAIN_OPTION_LABEL,
		),
	);
	const totalVotes = $derived(results?.results.counts.totalVotes ?? 0);
	const usableVotes = $derived(results?.results.counts.usableVotes ?? 0);

	function isWinningOption(optionIndex: number) {
		return winners.some((winner) => winner.optionIndex === optionIndex);
	}
</script>

{#if results}
	<div
		class={cn(
			'rounded-lg border px-4 py-3',
			winners.length > 0 && 'border-green-400 bg-green-50 text-green-800',
		)}
	>
		<div class="font-medium">Resultat</div>
		<div class="text-xl font-semibold">
			{#if winners.length === 0}
				Ingen nådde majoriteten.
			{:else}
				{winners.map((winner) => winner.option).join(', ')}
			{/if}
		</div>
	</div>
	{#if meeting.isAdmin && optionTotals.length > 0}
		<div class="space-y-4">
			<div class="grid w-max grid-cols-2 gap-x-4 text-sm text-muted-foreground">
				<span>Total mängd röster</span>
				<span>{totalVotes} st</span>

				<span>Röster (ej avstår)</span>
				<span>{usableVotes} st ({getVoteShare(usableVotes, totalVotes)}%)</span>

				<span>Avstår</span>
				<span>
					{results.results.counts.abstain} st ({getVoteShare(
						results.results.counts.abstain,
						totalVotes,
					)}%)
				</span>
			</div>
			<ul class="space-y-2">
				{#each winners as option (option.optionIndex)}
					{@render resultRow(option)}
				{/each}
				<Separator class="my-4" />
				{#each optionTotals.slice(winners.length) as option, idx (option.optionIndex)}
					{@render resultRow(option)}
				{/each}
			</ul>

			<p class="text-sm text-muted-foreground">
				Komplett resultat: {results.complete ? 'ja' : 'nej'}.
			</p>
		</div>
	{/if}
{/if}

{#snippet resultRow(option: Omit<OptionTotal, 'votes'> & { votes: number | undefined })}
	<li
		class={cn(
			'flex flex-col rounded-md border px-4 py-3',
			isWinningOption(option.optionIndex) && 'border-green-400 bg-green-50 text-green-800',
		)}
	>
		<div class="flex items-center justify-between gap-2">
			<span class="font-bold">{option.option}</span>
			<span>{option.votes ?? 0} röster</span>
		</div>
		<Progress value={option.votes ?? 0} max={usableVotes} class="text-current" />
		<div class="ml-auto text-xs text-current/70">
			{getVoteShare(option.votes ?? 0, usableVotes)}%
		</div>
	</li>
{/snippet}
