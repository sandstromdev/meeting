<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import PollResultsDisplay, {
		type PollResultsDisplayData,
	} from '$lib/components/poll-results-display.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as Field from '$lib/components/ui/field';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type CurrentPoll = NonNullable<typeof api.meeting.users.meetingPoll.getCurrentPoll._returnType>;
	type PollCounters = NonNullable<
		typeof api.meeting.users.meetingPoll.getCurrentPollCounters._returnType
	>;

	let {
		poll,
		counters,
		pollResults,
		showDetailedResults,
		isProjector,
		isAbsent,
		isAdmin,
		currentMeetingPollId,
		onVote,
		onRetractVote,
		onClosePollAndShowResults,
		onCancelPoll,
		onClearCurrentPollId,
		onOpenPoll,
		adminExtras,
	}: {
		poll: CurrentPoll | null;
		counters: PollCounters;
		pollResults: PollResultsDisplayData | null;
		showDetailedResults: boolean;
		isProjector: boolean;
		isAbsent: boolean;
		isAdmin: boolean;
		currentMeetingPollId: Id<'meetingPolls'> | null | undefined;
		onVote: (optionIndexes: number[]) => Promise<void>;
		onRetractVote: () => Promise<void>;
		/** Admin-only; omit when `isAdmin` is false. */
		onClosePollAndShowResults?: () => Promise<void>;
		onCancelPoll?: () => Promise<void>;
		onClearCurrentPollId?: () => Promise<void>;
		onOpenPoll?: () => Promise<void>;
		adminExtras?: Snippet;
	} = $props();

	let isSubmitting = $state(false);
	let isRetracting = $state(false);

	let selectedOptionIndexes = new SvelteSet<number>();
	let isChangingVote = $state(false);
	let previousVoteOptionIndexes = $state<number[]>([]);

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
	const isDialogOpen = $derived(!isProjector && !!poll);

	const canVote = $derived(
		!!poll &&
			poll.isOpen &&
			effectiveSelection.length > 0 &&
			effectiveSelection.length <= poll.maxVotesPerVoter &&
			(!poll.hasVoted || isChangingVote),
	);

	const canSelectMoreOptions = $derived(selectedOptionIndexes.size < (poll?.maxVotesPerVoter ?? 1));

	function toggleOption(optionIndex: number, checked: boolean) {
		const votingAllowed = !poll?.hasVoted || isChangingVote;
		const isSingleChoice = poll != null && poll.maxVotesPerVoter === 1;
		if (!poll || !votingAllowed || !poll.isOpen) {
			return;
		}
		// Multi-select at cap: cannot add another option (unchecking still allowed below).
		if (
			checked &&
			!isSingleChoice &&
			!canSelectMoreOptions &&
			!selectedOptionIndexes.has(optionIndex)
		) {
			return;
		}

		if (!checked) {
			selectedOptionIndexes.delete(optionIndex);
		} else if (isSingleChoice) {
			selectedOptionIndexes.clear();
			selectedOptionIndexes.add(optionIndex);
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
			await onRetractVote();
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
			await onVote(effectiveSelection);
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
			await onVote(previousVoteOptionIndexes);
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
			(isMultiWinner &&
				poll?.maxVotesPerVoter !== 1 &&
				!canSelectMoreOptions &&
				!selectedOptionIndexes.has(optionIndex))
		);
	}
</script>

{#if poll}
	{#if !isProjector && !isAbsent}
		<AlertDialog.Root open={isDialogOpen}>
			<AlertDialog.Content
				class="inset-0 grid max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-4 sm:top-[50%] sm:left-[50%] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6"
			>
				<div class="flex flex-col gap-4 overflow-y-auto">
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

					{#if isAdmin && poll.isOpen && adminExtras}
						{@render adminExtras()}
					{/if}

					<ScrollArea class="">
						<div class="space-y-2">
							{#if poll.isOpen}
								{#if poll.hasVoted && !isChangingVote}
									<p class="text-sm text-muted-foreground">
										Du har röstat ({poll.myVoteOptionIndexes.length}/{poll.maxVotesPerVoter}).
									</p>
									<p class="text-xs text-muted-foreground">
										Dina röster: {poll.myVoteOptionIndexes
											.map((i) => poll.options[i].title)
											.join(', ')}
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
											{#if isMultiWinner && poll.maxVotesPerVoter > 1}
												<div class="flex flex-col gap-2">
													{#each poll.options as option, optionIndex (optionIndex)}
														<Field.Label for={optionIndex.toString()}>
															<Field.Field orientation="horizontal">
																<Field.Content>
																	<Field.Title>{option.title}</Field.Title>
																	{#if option.description}
																		<Field.Description>{option.description}</Field.Description>
																	{/if}
																</Field.Content>
																<Checkbox
																	checked={selectedOptionIndexes.has(optionIndex)}
																	onCheckedChange={(checked) => toggleOption(optionIndex, checked)}
																	disabled={isOptionDisabled(optionIndex)}
																	id={optionIndex.toString()}
																/>
															</Field.Field>
														</Field.Label>
													{/each}
												</div>
											{:else}
												<RadioGroup.Root
													class="gap-2"
													value={effectiveSelection[0]?.toString()}
													onValueChange={(value) => toggleOption(Number(value), true)}
												>
													{#each poll.options as option, optionIndex (optionIndex)}
														<Field.Label for={optionIndex.toString()}>
															<Field.Field orientation="horizontal">
																<Field.Content>
																	<Field.Title>{option.title}</Field.Title>
																	{#if option.description}
																		<Field.Description>{option.description}</Field.Description>
																	{/if}
																</Field.Content>
																<RadioGroup.Item
																	value={optionIndex.toString()}
																	id={optionIndex.toString()}
																	disabled={isOptionDisabled(optionIndex)}
																/>
															</Field.Field>
														</Field.Label>
													{/each}
												</RadioGroup.Root>
											{/if}
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
								<PollResultsDisplay data={pollResults} {showDetailedResults} />
							{/if}
						</div>
					</ScrollArea>

					{#if isAdmin}
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
											onConfirm: async () => {
												await onClosePollAndShowResults?.();
											},
										})}>Stäng och visa resultat</Button
								>
								<Button
									variant="destructive"
									onclick={async () => {
										await onCancelPoll?.();
									}}>Avbryt</Button
								>
							{:else if currentMeetingPollId === poll.id}
								<Button
									onclick={async () => {
										await onClearCurrentPollId?.();
									}}>Stäng</Button
								>
							{:else}
								<Button
									onclick={async () => {
										await onOpenPoll?.();
									}}>Öppna</Button
								>
							{/if}
						</div>
					{/if}
				</div>
			</AlertDialog.Content>
		</AlertDialog.Root>
	{/if}
{/if}
