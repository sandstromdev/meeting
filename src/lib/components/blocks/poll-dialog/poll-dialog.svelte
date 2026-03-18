<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Requests from '$lib/components/blocks/poll-dialog/requests.svelte';
	import Results from '$lib/components/blocks/poll-dialog/results.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import * as CheckboxBlock from '$lib/components/ui/checkbox-block';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as RadioBlock from '$lib/components/ui/radio-block';
	import RadioGroup from '$lib/components/ui/radio-group/radio-group.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	const meeting = getMeetingContext();
	const ps = usePageState();
	const currentPoll = meeting.query(api.users.poll.getCurrentPoll);
	const currentPollCounters = meeting.query(api.users.poll.getCurrentPollCounters);

	const counters = $derived(
		currentPollCounters.data ?? { votersCount: 0, eligibleVoters: 0, votesCount: 0 },
	);

	let isSubmitting = $state(false);
	let isRetracting = $state(false);

	let selectedOptionIndexes = new SvelteSet<number>();
	let isChangingVote = $state(false);
	/** When in change mode, the option indexes the user had before retracting (for cancel and hasSelectionChanged). */
	let previousVoteOptionIndexes = $state<number[]>([]);

	const poll = $derived(currentPoll.data ?? null);

	$effect(() => {
		if (poll?.hasVoted && poll.isOpen && isChangingVote) {
			selectedOptionIndexes.clear();
			for (const i of poll.myVoteOptionIndexes) {
				selectedOptionIndexes.add(i);
			}
		}
	});

	const isMultiWinner = $derived(poll?.type === 'multi_winner');

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
	const hasSelectionChanged = $derived(
		(() => {
			const current = isChangingVote
				? previousVoteOptionIndexes
				: (poll?.myVoteOptionIndexes ?? []);
			if (current.length === 0) {
				return true;
			}
			const curr = [...current].toSorted();
			const selected = [...effectiveSelection].toSorted();
			return curr.length !== selected.length || curr.some((v, i) => v !== selected[i]);
		})(),
	);

	const canVote = $derived(
		!!poll &&
			poll.isOpen &&
			effectiveSelection.length > 0 &&
			effectiveSelection.length <= poll.maxVotesPerVoter &&
			(isChangingVote ? hasSelectionChanged : !poll.hasVoted),
	);

	const canSelectMoreOptions = $derived(selectedOptionIndexes.size < (poll?.maxVotesPerVoter ?? 1));

	function toggleOption(optionIndex: number, checked: boolean) {
		const votingAllowed = !poll?.hasVoted || isChangingVote;
		if (
			!poll ||
			!votingAllowed ||
			!poll.isOpen ||
			(!canSelectMoreOptions && !selectedOptionIndexes.has(optionIndex))
		) {
			return;
		}

		if (!checked) {
			selectedOptionIndexes.delete(optionIndex);
		} else if (selectedOptionIndexes.size < poll.maxVotesPerVoter) {
			selectedOptionIndexes.add(optionIndex);
		}
	}

	async function enterChangeMode() {
		if (!poll || !poll.hasVoted || !poll.isOpen) {
			return;
		}
		const prev = [...poll.myVoteOptionIndexes];
		previousVoteOptionIndexes = prev;
		selectedOptionIndexes.clear();
		for (const i of prev) {
			selectedOptionIndexes.add(i);
		}
		isRetracting = true;
		try {
			await meeting.mutate(api.users.poll.retractVote, { pollId: poll.id });
			isChangingVote = true;
		} finally {
			isRetracting = false;
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
			previousVoteOptionIndexes = [];
			isChangingVote = false;
		} finally {
			isSubmitting = false;
		}
	}

	async function cancelChangeMode() {
		if (!poll || !isChangingVote || previousVoteOptionIndexes.length === 0) {
			return;
		}
		isSubmitting = true;
		try {
			await meeting.mutate(api.users.poll.vote, {
				pollId: poll.id,
				optionIndexes: previousVoteOptionIndexes,
			});
			selectedOptionIndexes.clear();
			previousVoteOptionIndexes = [];
			isChangingVote = false;
		} finally {
			isSubmitting = false;
		}
	}

	function isOptionDisabled(optionIndex: number) {
		return (
			(poll?.hasVoted && !isChangingVote) ||
			(isMultiWinner && !canSelectMoreOptions && !selectedOptionIndexes.has(optionIndex))
		);
	}
</script>

{#if !ps.isProjector && poll && !meeting.isAbsent}
	<AlertDialog.Root open={isDialogOpen}>
		<AlertDialog.Content
			class="!inset-0 !grid !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !p-4 sm:!top-[50%] sm:!left-[50%] sm:!h-max sm:!w-full sm:!max-w-lg sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-lg sm:!border sm:!p-6"
		>
			<div class="flex max-h-[100dvh] flex-col gap-4 overflow-y-auto">
				<AlertDialog.Header>
					<AlertDialog.Title>{poll.title}</AlertDialog.Title>
					<AlertDialog.Description>
						{#if poll.isOpen}
							Sluten omröstning pågår.
						{:else}
							Omröstning stängd.
						{/if}
						Röstande: {counters.votersCount}/{counters.eligibleVoters}. Röster:
						{counters.votesCount}.
					</AlertDialog.Description>
				</AlertDialog.Header>

				{#if meeting.isAdmin && poll.isOpen}
					<Requests />
				{/if}

				{#if poll.isOpen}
					{#if poll.hasVoted && !isChangingVote}
						<p class="text-sm text-muted-foreground">
							Du har röstat ({poll.myVoteOptionIndexes.length}/{poll.maxVotesPerVoter}).
						</p>
						<p class="text-xs text-muted-foreground">
							Dina röster: {poll.myVoteOptionIndexes.map((i) => poll.options[i]).join(', ')}
						</p>
						<div class="mt-auto">
							<Button
								variant="outline"
								onclick={enterChangeMode}
								loading={isRetracting}
								disabled={isRetracting}
							>
								Ändra röst
							</Button>
						</div>
					{:else}
						<Field.Set>
							<Field.Legend>Välj alternativ</Field.Legend>
							<Field.Description
								>{isMultiWinner
									? 'Välj upp till ' + poll.maxVotesPerVoter + ' alternativ.'
									: 'Välj ett alternativ.'}</Field.Description
							>
							<Field.Content>
								<ScrollArea class="h-[30vh]">
									{#if isMultiWinner}
										<div class="flex flex-col gap-2">
											{#each poll.options as option, optionIndex (optionIndex)}
												<CheckboxBlock.Root>
													<CheckboxBlock.Checkbox
														checked={selectedOptionIndexes.has(optionIndex)}
														onCheckedChange={(checked) => toggleOption(optionIndex, checked)}
														disabled={isOptionDisabled(optionIndex)}
													/>
													<CheckboxBlock.Content>
														<CheckboxBlock.Title>{option}</CheckboxBlock.Title>
													</CheckboxBlock.Content>
												</CheckboxBlock.Root>
											{/each}
										</div>
									{:else}
										<RadioGroup
											class="gap-2"
											value={effectiveSelection[0]?.toString()}
											onValueChange={(value) => toggleOption(Number(value), true)}
										>
											{#each poll.options as option, optionIndex (optionIndex)}
												<RadioBlock.Root>
													<RadioBlock.Item
														value={optionIndex.toString()}
														disabled={isOptionDisabled(optionIndex)}
													/>
													<RadioBlock.Content>
														<RadioBlock.Title>{option}</RadioBlock.Title>
													</RadioBlock.Content>
												</RadioBlock.Root>
											{/each}
										</RadioGroup>
									{/if}
								</ScrollArea>
							</Field.Content>
						</Field.Set>
						<div class="mt-auto flex items-center gap-2">
							<Button onclick={submitVote} loading={isSubmitting} disabled={!canVote}>
								{isChangingVote ? 'Ändra röst' : 'Rösta'}
							</Button>
							{#if isChangingVote}
								<Button variant="ghost" onclick={cancelChangeMode} disabled={isSubmitting}>
									Avbryt
								</Button>
							{/if}
							<span class="text-xs text-muted-foreground">
								Valt {effectiveSelection.length} av {poll.maxVotesPerVoter}
							</span>
						</div>
					{/if}
				{:else}
					<Results pollId={poll.id} />
				{/if}

				{#if meeting.isAdmin}
					<div class="mt-auto flex items-center gap-2">
						{#if poll.isOpen}
							<Button
								onclick={() =>
									confirm({
										title: 'Stäng och visa resultat?',
										description:
											counters.votersCount +
											' av ' +
											counters.eligibleVoters +
											' har röstat. Är du säker på att du vill stänga omröstningen och visa resultatet?',
										onConfirm: () =>
											meeting.adminMutate(api.admin.poll.closePollAndShowResults, {
												pollId: poll.id,
											}),
									})}>Stäng och visa resultat</Button
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
