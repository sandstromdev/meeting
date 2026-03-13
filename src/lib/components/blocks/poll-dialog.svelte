<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	const meeting = getMeetingContext();
	const ps = usePageState();
	const currentPoll = meeting.query(api.users.poll.getCurrentPoll);

	let isSubmitting = $state(false);
	let selectedOptionIndexes = $state<number[]>([]);

	const poll = $derived(currentPoll.data ?? null);
	const effectiveSelection = $derived(
		poll
			? selectedOptionIndexes
					.filter((optionIndex) => optionIndex >= 0 && optionIndex < poll.options.length)
					.slice(0, poll.maxVotesPerVoter)
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

	function toggleOption(optionIndex: number) {
		if (!poll || poll.hasVoted || !poll.isOpen) {
			return;
		}

		if (selectedOptionIndexes.includes(optionIndex)) {
			selectedOptionIndexes = selectedOptionIndexes.filter((i) => i !== optionIndex);
			return;
		}

		if (selectedOptionIndexes.length >= poll.maxVotesPerVoter) {
			return;
		}

		selectedOptionIndexes = [...selectedOptionIndexes, optionIndex];
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
			selectedOptionIndexes = [];
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
							Omröstning stangd. Röstande: {poll.votersCount}/{poll.eligibleVoters}. Röster:
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
									<input
										type="checkbox"
										checked={effectiveSelection.includes(optionIndex)}
										onchange={() => toggleOption(optionIndex)}
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
					{#if poll.winnerOptionIndexes?.length !== undefined}
						<p class="text-sm font-medium">
							{#if poll.winnerOptionIndexes.length === 0}
								Ingen vinnare (ingen nadde majoriteten).
							{:else if poll.isTie}
								Oavgjort: {poll.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
							{:else if poll.winnerOptionIndexes.length === 1}
								Vinnare: {poll.options[poll.winnerOptionIndexes[0]]}
							{:else}
								Vinnare: {poll.winnerOptionIndexes.map((i) => poll.options[i]).join(', ')}
							{/if}
						</p>
					{/if}

					{#if poll.optionTotals}
						<ul class="space-y-1 text-sm text-muted-foreground">
							{#each poll.optionTotals as option (option.optionIndex)}
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
							Resultatet visas endast for administratörer.
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
