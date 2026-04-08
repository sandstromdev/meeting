<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Field from '$lib/components/ui/field';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import {
		getPollByCode as getPollByCodeRemote,
		retractVote as retractVoteRemote,
		vote as voteRemote,
	} from './data.remote';
	import { toast } from 'svelte-sonner';
	import Delayed from '$lib/components/ui/delayed.svelte';
	import { useInterval } from 'runed';

	let { data } = $props();

	let draftSelectedOptionIndexes = $state<number[] | null>(null);
	let submitting = $state(false);

	let poll = $derived(data.poll);
	const currentUser = $derived(data.currentUser);

	let lastUpdatedAt = $state(0);

	useInterval(10_000, {
		callback: async () => {
			if (!data.poll) {
				return;
			}

			const result = await getPollByCodeRemote({
				code: data.poll.code,
				voterSessionToken: data.voterSessionToken,
			});

			if (result.ok) {
				if (JSON.stringify(result.poll) !== JSON.stringify(poll)) {
					poll = result.poll;
					lastUpdatedAt = Date.now();
				}
			} else {
				console.error(result);
			}
		},
	});

	const selectedOptionIndexes = $derived(
		draftSelectedOptionIndexes ?? poll?.myVoteOptionIndexes ?? [],
	);
	const selectedSet = $derived(new Set(selectedOptionIndexes));
	const maxReached = $derived(
		poll?.type === 'multi_winner' &&
			poll?.maxVotesPerVoter != null &&
			selectedOptionIndexes.length >= poll.maxVotesPerVoter,
	);
	const canSubmit = $derived(
		poll?.isOpen === true &&
			selectedOptionIndexes.length > 0 &&
			selectedOptionIndexes.length <= (poll.maxVotesPerVoter ?? 0),
	);

	function toggleMultiOption(optionIndex: number) {
		if (selectedSet.has(optionIndex)) {
			draftSelectedOptionIndexes = selectedOptionIndexes.filter(
				(idx: number) => idx !== optionIndex,
			);
			return;
		}
		if (maxReached) {
			return;
		}
		draftSelectedOptionIndexes = [...selectedOptionIndexes, optionIndex];
	}

	async function submitVote() {
		if (!poll || !canSubmit || submitting) {
			return;
		}
		try {
			submitting = true;
			const result = await voteRemote({
				pollId: poll.id,
				optionIndexes: selectedOptionIndexes,
				voterSessionToken: data.voterSessionToken,
			});
			if (result.ok) {
				draftSelectedOptionIndexes = [...selectedOptionIndexes];
				toast.success('Din röst har sparats.');
				await invalidateAll();
			} else {
				console.error(result);
				toast.error(result.error.message);
			}
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte spara din röst.');
		} finally {
			submitting = false;
		}
	}

	async function retractVote() {
		if (!poll || submitting) {
			return;
		}
		try {
			submitting = true;
			const result = await retractVoteRemote({
				pollId: poll.id,
				voterSessionToken: data.voterSessionToken,
			});
			if (result.ok) {
				draftSelectedOptionIndexes = [];
				toast.success('Din röst har tagits bort.');
				await invalidateAll();
			} else {
				console.error(result);
				toast.error(result.error.message);
			}
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte ta bort din röst.');
		} finally {
			submitting = false;
		}
	}

	function isOptionDisabled(optionIndex: number) {
		if (poll?.type !== 'multi_winner') {
			return false;
		}
		return maxReached && !selectedSet.has(optionIndex);
	}
</script>

<SeoHead
	title={poll?.title ?? 'Röstning hittades inte'}
	description={!poll
		? 'Omröstningen kunde inte hittas. Kontrollera länken.'
		: poll.isOpen
			? 'Rösta i denna omröstning via m.lsnd.se.'
			: 'Visa resultat och information om omröstningen.'}
/>

<main class="mx-auto max-w-2xl space-y-6 p-4 lg:py-10">
	{#if !poll}
		<Alert.Root variant="destructive">
			<Alert.Title>Omröstningen hittades inte</Alert.Title>
			<Alert.Description>Kontrollera länken och försök igen.</Alert.Description>
		</Alert.Root>
	{:else if poll.visibilityMode === 'account_required' && currentUser == null}
		<Alert.Root variant="destructive">
			<Alert.Title>Du måste vara inloggad för att rösta i den här omröstningen.</Alert.Title>
			<Alert.Description>
				<Button
					variant="link"
					class="inline h-auto p-0 text-sm"
					href={resolve(
						`/sign-in?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`,
					)}
				>
					Logga in här
				</Button>.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-2xl font-bold">{poll.title}</Card.Title>
				<Card.Description>
					Kod:
					<code class="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{poll.code}</code>
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4 pt-0">
				<div class="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
					<p>Status: {poll.isOpen ? 'Öppen' : 'Stängd'}</p>
					<p>Synlighet: {poll.visibilityMode === 'account_required' ? 'Konto krävs' : 'Publik'}</p>
				</div>
			</Card.Content>
		</Card.Root>

		{#if poll.isOpen}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-lg font-semibold">Rösta</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4 pt-0">
					{#if poll.type === 'single_winner'}
						<div class="space-y-2">
							<RadioGroup.Root
								value={draftSelectedOptionIndexes?.[0]?.toString()}
								onValueChange={(value) => (draftSelectedOptionIndexes = [Number(value)])}
							>
								{#each poll.options as option, optionIndex (optionIndex)}
									<Field.Label for="option-{optionIndex.toString()}">
										<Field.Field orientation="horizontal">
											<Field.Content>
												<Field.Title>{option}</Field.Title>
											</Field.Content>
											<RadioGroup.Item
												value={optionIndex.toString()}
												disabled={isOptionDisabled(optionIndex)}
												id="option-{optionIndex.toString()}"
											/>
										</Field.Field>
									</Field.Label>
								{/each}
							</RadioGroup.Root>
						</div>
					{:else}
						<div class="space-y-2">
							{#each poll.options as option, optionIndex (optionIndex)}
								<Field.Label for="option-{optionIndex.toString()}">
									<Field.Field orientation="horizontal">
										<Field.Content>
											<Field.Title>{option}</Field.Title>
										</Field.Content>
										<Checkbox
											checked={selectedSet.has(optionIndex)}
											disabled={isOptionDisabled(optionIndex)}
											onchange={() => toggleMultiOption(optionIndex)}
											id="option-{optionIndex.toString()}"
										/>
									</Field.Field>
								</Field.Label>
							{/each}
						</div>
						<p class="text-xs text-muted-foreground">
							Du kan välja upp till {poll.maxVotesPerVoter} alternativ.
						</p>
					{/if}

					<div class="flex flex-wrap gap-2">
						<Button onclick={submitVote} disabled={!canSubmit || submitting}>
							{submitting ? 'Sparar...' : 'Skicka röst'}
						</Button>
						<Button variant="outline" onclick={retractVote} disabled={submitting || !poll.hasVoted}>
							Ta bort min röst
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-lg font-semibold">Omröstningen är stängd</Card.Title>
					<Card.Description>Den här omröstningen tar inte längre emot röster.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4 pt-0">
					{#if poll.results && poll.isResultPublic}
						<PollResultsDisplay data={{ results: poll.results }} showDetailedResults />
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}

	{#key lastUpdatedAt}
		<Delayed delay={10_000}>
			<Button variant="link" class="mx-auto" onclick={() => location.reload()}
				>Ladda om sidan</Button
			>
		</Delayed>
	{/key}
</main>
