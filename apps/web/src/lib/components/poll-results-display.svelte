<script lang="ts">
	import type { PollOptionTotal } from '@lsnd-mt/convex/helpers/poll';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type { PollResultVisibility } from '$lib/pollResultVisibility';
	import { ABSTAIN_OPTION_LABEL, getVoteShare } from '$lib/polls';
	import { cn } from '$lib/utils';

	/** Snapshot shape returned by poll result queries (meeting or standalone). */
	export type PollResultsDisplayData = {
		complete?: boolean;
		results: {
			winners: Array<{
				optionIndex: number;
				option: string;
				description?: string | null;
				votes?: number;
			}>;
			optionTotals?: PollOptionTotal[] | undefined;
			counts?: { totalVotes: number; usableVotes: number; abstain: number };
		};
	};

	let {
		data = null,
		resultVisibility = 'none',
		size = 'sm',
	}: {
		data: PollResultsDisplayData | null;
		resultVisibility?: PollResultVisibility;
		size?: 'sm' | 'lg';
	} = $props();

	const winners = $derived(data?.results.winners ?? []);

	const optionTotals = $derived(
		(data?.results.optionTotals ?? []).filter((option) => option.option !== ABSTAIN_OPTION_LABEL),
	);
	const counts = $derived(data?.results.counts);
	const totalVotes = $derived(counts?.totalVotes ?? 0);
	const usableVotes = $derived(counts?.usableVotes ?? 0);

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
				<div>{winners[0].option}</div>
				{#if winners[0].description}
					<div class="mt-1 text-base font-normal text-muted-foreground">
						{winners[0].description}
					</div>
				{/if}
			{:else}
				<ul>
					{#each winners as winner (winner.optionIndex)}
						<li>
							{winner.option}
							{#if winner.description}
								<div class="text-base font-normal text-muted-foreground">{winner.description}</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
	{#if resultVisibility === 'full' && counts}
		<div class="space-y-4">
			<div
				class={cn(
					'grid w-max grid-cols-2 gap-x-4 text-sm text-muted-foreground',
					size === 'lg' && 'text-base',
				)}
			>
				<span>Total mängd röster</span>
				<span>{totalVotes} st</span>

				<span>Röster (ej avstår)</span>
				<span>{usableVotes} st ({getVoteShare(usableVotes, totalVotes)}%)</span>

				<span>Avstår</span>
				<span>
					{counts.abstain} st ({getVoteShare(counts.abstain, totalVotes)}%)
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

{#snippet resultRow(option: {
	optionIndex: number;
	option: string;
	description?: string | null;
	votes?: number;
})}
	<li
		class={cn(
			'flex flex-col rounded-md border px-4 py-3',
			isWinningOption(option.optionIndex) &&
				'border-green-800/20 bg-green-50 text-green-800  dark:bg-green-700/10 dark:text-green-600',
		)}
	>
		<div class={cn('flex items-center justify-between gap-2', size === 'lg' && 'text-xl')}>
			<span class="truncate font-bold">{option.option}</span>
			{#if option.votes != null}
				<span>{option.votes} röster</span>
			{/if}
		</div>
		{#if option.description}
			<p class="text-sm text-muted-foreground">{option.description}</p>
		{/if}
		{#if option.votes != null && usableVotes > 0}
			<Progress value={option.votes} max={usableVotes} class="text-current" />
			<div class="ml-auto text-xs text-current/70">
				{getVoteShare(option.votes, usableVotes)}%
			</div>
		{/if}
	</li>
{/snippet}
