<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { SvelteSet } from 'svelte/reactivity';
	import { useQuery } from '@mmailaender/convex-svelte';

	const meeting = getMeetingContext();
	const ps = usePageState();
	const currentPoll = meeting.query(api.users.poll.getCurrentPoll);

	let isSubmitting = $state(false);
	let selectedOptionIndexes = new SvelteSet<number>();

	const poll = $derived(currentPoll.data ?? null);
	const pollResults = useQuery(api.users.poll.getPollResultsById, () => {
		if (!meeting.id || !poll) {
			return 'skip';
		}
		return { meetingId: meeting.id, pollId: poll.id };
	});
	const results = $derived(pollResults.data ?? null);
	const effectiveSelection = $derived(
		poll
			? selectedOptionIndexes
					.values()
					.filter((optionIndex) => optionIndex >= 0 && optionIndex < poll.options.length)
					.take(poll.maxVotesPerVoter)
					.toArray()
			: [],
	);
	const isDialogOpen = $derived(!ps.isProjector && !!poll);
	const canVote = $derived(
		!!poll &&
			poll.isOpen &&
			!poll.hasVoted &&
			effectiveSelection.length > 0 &&
			effectiveSelection.length <= poll.maxVotesPerVoter,
	);

	function toggleOption(optionIndex: number, checked: boolean) {
		if (!poll || poll.hasVoted || !poll.isOpen) {
			return;
		}

		if (!checked) {
			selectedOptionIndexes.delete(optionIndex);
		} else if (selectedOptionIndexes.size < poll.maxVotesPerVoter) {
			selectedOptionIndexes.add(optionIndex);
		}
	}

	async function submitVote() {
		if (!poll || !canVote) {
			return;
		}

		isSubmitting = true;
		try {
			await meeting.mutate(api.users.poll.vote, {
				pollId: poll.id,
				optionIndexes: effectiveSelection,
			});
			selectedOptionIndexes.clear();
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if !ps.isProjector && poll}
	<AlertDialog.Root open={isDialogOpen}>
		<AlertDialog.Content
			class="!inset-0 !top-0 !left-0 !grid !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !p-4 sm:!top-[50%] sm:!left-[50%] sm:!h-auto sm:!w-full sm:!max-w-lg sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-lg sm:!border sm:!p-6"
		>
			<div class="flex max-h-[100dvh] flex-col gap-4 overflow-y-auto">
				<AlertDialog.Header>
					<AlertDialog.Title>{poll.title}</AlertDialog.Title>
					<AlertDialog.Description>
						{#if poll.isOpen}
							Sluten omröstning pågår. Röstande: {poll.votersCount}/{poll.eligibleVoters}. Röster:
							{poll.votesCount}.
						{:else}
							Omröstning stängd. Röstande: {poll.votersCount}/{poll.eligibleVoters}. Röster:
							{poll.votesCount}.
						{/if}
					</AlertDialog.Description>
				</AlertDialog.Header>

				{#if poll.isOpen}
					{#if poll.hasVoted}
						<p class="text-sm text-muted-foreground">
							Du har röstat ({poll.myVoteOptionIndexes.length}/{poll.maxVotesPerVoter}).
						</p>
						<p class="text-xs text-muted-foreground">
							Dina röster: {poll.myVoteOptionIndexes.map((i) => poll.options[i]).join(', ')}
						</p>
					{:else}
						<div class="space-y-2">
							<p class="text-sm text-muted-foreground">
								{#if poll.type === 'single_winner'}
									Välj ett alternativ.
								{:else}
									Välj upp till {poll.maxVotesPerVoter} alternativ.
								{/if}
							</p>
							{#each poll.options as option, optionIndex (optionIndex)}
								<label class="flex items-center gap-2 rounded-md border p-3 text-sm">
									<Checkbox
										checked={effectiveSelection.includes(optionIndex)}
										onCheckedChange={(checked) => toggleOption(optionIndex, checked)}
									/>
									<span>{option}</span>
								</label>
							{/each}
						</div>
						<div class="mt-auto flex items-center gap-2">
							<Button onclick={submitVote} loading={isSubmitting} disabled={!canVote}>Rösta</Button>
							<span class="text-xs text-muted-foreground">
								Valt {effectiveSelection.length} av {poll.maxVotesPerVoter}
							</span>
						</div>
					{/if}
				{:else}
					{#if results?.winnerOptionIndexes?.length !== undefined}
						<p class="text-sm font-medium">
							{#if results.winnerOptionIndexes.length === 0}
								Ingen vinnare (ingen nådde majoriteten).
							{:else if results.isTie}
								Oavgjort: {results.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
							{:else if results.winnerOptionIndexes.length === 1}
								Vinnare: {poll.options[results.winnerOptionIndexes[0]]}
							{:else}
								Vinnare: {results.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
							{/if}
						</p>
					{/if}

					{#if results?.optionTotals}
						<ul class="space-y-1 text-sm text-muted-foreground">
							{#each results.optionTotals as option (option.optionIndex)}
								<li>
									{option.option}: {option.votes} ({(
										(option.votes / (poll.votesCount || 1)) *
										100
									).toFixed(1)}%)
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-muted-foreground">
							Resultatet visas endast för administratörer.
						</p>
					{/if}
				{/if}

				{#if meeting.isAdmin}
					<div class="mt-auto flex items-center gap-2">
						{#if poll.isOpen}
							<Button
								onclick={() =>
									meeting.adminMutate(api.admin.poll.closePollAndShowResults, { pollId: poll.id })}
								>Stäng och visa resultat</Button
							>
							<Button
								variant="destructive"
								onclick={() => meeting.adminMutate(api.admin.poll.cancelPoll, { pollId: poll.id })}
								>Avbryt</Button
							>
						{:else if meeting.meeting.currentPollId === poll.id}
							<Button onclick={() => meeting.adminMutate(api.admin.poll.clearCurrentPollId)}
								>Stäng</Button
							>
						{:else}
							<Button
								onclick={() => meeting.adminMutate(api.admin.poll.openPoll, { pollId: poll.id })}
								>Öppna</Button
							>
						{/if}
					</div>
				{/if}
			</div>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
