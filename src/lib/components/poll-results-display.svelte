<script lang="ts">
	import type { OptionTotal } from '$convex/helpers/meetingPoll';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { ABSTAIN_OPTION_LABEL, getVoteShare } from '$lib/polls';
	import { cn } from '$lib/utils';

	/** Snapshot shape returned by poll result queries (meeting or standalone). */
	export type PollResultsDisplayData = {
		complete?: boolean;
		results: {
			winners: Array<{ optionIndex: number; option: string; votes?: number }>;
			optionTotals?: OptionTotal[] | undefined;
			counts: { totalVotes: number; usableVotes: number; abstain: number };
		};
	};

	let {
		data = null,
		showDetailedResults = false,
	}: {
		data: PollResultsDisplayData | null;
		showDetailedResults?: boolean;
	} = $props();

	const winners = $derived(data?.results.winners ?? []);

	const optionTotals = $derived(
		(data?.results.optionTotals ?? []).filter((option) => option.option !== ABSTAIN_OPTION_LABEL),
	);
	const totalVotes = $derived(data?.results.counts.totalVotes ?? 0);
	const usableVotes = $derived(data?.results.counts.usableVotes ?? 0);

	function isWinningOption(optionIndex: number) {
		return winners.some((winner) => winner.optionIndex === optionIndex);
	}
</script>

{#if data}
	<div
		class={cn(
			'rounded-lg border px-4 py-3',
			winners.length > 0 &&
				'border-green-800/20 bg-green-50 text-green-800  dark:bg-green-700/10 dark:text-green-600',
		)}
	>
		<div class="font-medium">Resultat</div>
		<div class="text-xl font-semibold">
			{#if winners.length === 0}
				Ingen nådde majoriteten.
			{:else if winners.length === 1}
				{winners[0].option}
			{:else}
				<ul>
					{#each winners as winner (winner.optionIndex)}
						<li>{winner.option}</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
	{#if showDetailedResults}
		<div class="space-y-4">
			<div class="grid w-max grid-cols-2 gap-x-4 text-sm text-muted-foreground">
				<span>Total mängd röster</span>
				<span>{totalVotes} st</span>

				<span>Röster (ej avstår)</span>
				<span>{usableVotes} st ({getVoteShare(usableVotes, totalVotes)}%)</span>

				<span>Avstår</span>
				<span>
					{data.results.counts.abstain} st ({getVoteShare(
						data.results.counts.abstain,
						totalVotes,
					)}%)
				</span>
			</div>
			<ul class="space-y-2">
				{#each winners as option (option.optionIndex)}
					{@render resultRow(option)}
				{/each}
				<Separator class="my-4" />
				{#each optionTotals.slice(winners.length) as option (option.optionIndex)}
					{@render resultRow(option)}
				{/each}
			</ul>

			{#if data.complete !== undefined}
				<p class="text-sm text-muted-foreground">
					Komplett resultat: {data.complete ? 'ja' : 'nej'}.
				</p>
			{/if}
		</div>
	{/if}
{/if}

{#snippet resultRow(option: { optionIndex: number; option: string; votes?: number })}
	<li
		class={cn(
			'flex flex-col rounded-md border px-4 py-3',
			isWinningOption(option.optionIndex) &&
				'border-green-800/20 bg-green-50 text-green-800  dark:bg-green-700/10 dark:text-green-600',
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
