<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const convex = useConvexClient();
	const currentUser = useQuery(api.me.getCurrentUser, {});
	const pollCode = $derived(typeof page.params.code === 'string' ? page.params.code : '');
	const standalonePollApi = api.public.standalone_poll;

	type Poll = {
		id: Id<'standalonePolls'>;
		code: string;
		title: string;
		options: string[];
		type: 'single_winner' | 'multi_winner';
		maxVotesPerVoter: number;
		isOpen: boolean;
		visibilityMode: 'public' | 'account_required';
		votesCount: number;
		votersCount: number;
		hasVoted: boolean;
		myVoteOptionIndexes: number[];
		results: {
			optionTotals: Array<{ optionIndex: number; option: string; votes: number }>;
			winners: Array<{ option: string }>;
		} | null;
	};

	let voterSessionKey = $state<string | null>(null);
	let draftSelectedOptionIndexes = $state<number[] | null>(null);
	let submitting = $state(false);
	let poll = $state<Poll | null>(null);
	let isLoading = $state(false);
	let loadError = $state<string | null>(null);

	onMount(() => {
		const storageKey = 'standalone_poll_voter_key';
		const existing = localStorage.getItem(storageKey);
		if (existing) {
			voterSessionKey = existing;
			return;
		}

		const generated = crypto.randomUUID();
		localStorage.setItem(storageKey, generated);
		voterSessionKey = generated;
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
	const requiresSignIn = $derived(
		poll?.visibilityMode === 'account_required' && currentUser.data == null,
	);
	const signInHref = $derived(
		resolve(`/sign-in?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`),
	);

	$effect(() => {
		const code = pollCode.trim();
		const currentVoterSessionKey = voterSessionKey;
		const requestKey = `${code}:${currentVoterSessionKey ?? ''}`;

		if (!code) {
			poll = null;
			isLoading = false;
			loadError = null;
			return;
		}

		let cancelled = false;
		isLoading = true;
		loadError = null;

		void convex
			.query(standalonePollApi.get_by_code, {
				code,
				voterSessionKey: currentVoterSessionKey,
			})
			.then((result) => {
				if (cancelled) {
					return;
				}
				if (requestKey !== `${pollCode.trim()}:${voterSessionKey ?? ''}`) {
					return;
				}
				poll = result as Poll | null;
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				console.error(error);
				loadError = 'Kunde inte ladda omröstningen.';
				poll = null;
			})
			.finally(() => {
				if (cancelled) {
					return;
				}
				if (requestKey === `${pollCode.trim()}:${voterSessionKey ?? ''}`) {
					isLoading = false;
				}
			});

		return () => {
			cancelled = true;
		};
	});

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
			await convex.mutation(standalonePollApi.vote, {
				pollId: poll.id,
				optionIndexes: selectedOptionIndexes,
				voterSessionKey,
			});
			draftSelectedOptionIndexes = [...selectedOptionIndexes];
			toast.success('Din röst har sparats.');
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
			await convex.mutation(standalonePollApi.retract_vote, {
				pollId: poll.id,
				voterSessionKey,
			});
			draftSelectedOptionIndexes = [];
			toast.success('Din röst har tagits bort.');
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

<main class="mx-auto max-w-2xl space-y-6 p-4 lg:py-10">
	{#if isLoading}
		<section class="rounded-md border p-4">
			<p class="text-sm text-muted-foreground">Laddar omröstning...</p>
		</section>
	{:else if loadError}
		<section class="rounded-md border p-4">
			<h1 class="text-xl font-semibold">Omröstningen kunde inte hittas</h1>
			<p class="mt-2 text-sm text-muted-foreground">Kontrollera länken och försök igen.</p>
		</section>
	{:else if !poll}
		<section class="rounded-md border p-4">
			<h1 class="text-xl font-semibold">Omröstningen kunde inte hittas</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Det finns ingen omröstning för den här koden.
			</p>
		</section>
	{:else}
		<section class="space-y-2 rounded-md border p-4">
			<h1 class="text-2xl font-bold">{poll.title}</h1>
			<p class="text-sm text-muted-foreground">Kod: <code>{poll.code}</code></p>
			<div class="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
				<p>Röster: {poll.votesCount}</p>
				<p>Röstande: {poll.votersCount}</p>
				<p>Status: {poll.isOpen ? 'Öppen' : 'Stängd'}</p>
				<p>Synlighet: {poll.visibilityMode === 'account_required' ? 'Konto krävs' : 'Publik'}</p>
			</div>
		</section>

		{#if requiresSignIn}
			<section class="rounded-md border p-4">
				<p class="text-sm">
					Du måste vara inloggad för att rösta i den här omröstningen.
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a class="underline" href={signInHref}>Logga in här</a>.
				</p>
			</section>
		{:else if poll.isOpen}
			<section class="space-y-4 rounded-md border p-4">
				<h2 class="text-lg font-semibold">Rösta</h2>
				{#if poll.type === 'single_winner'}
					<div class="space-y-2">
						{#each poll.options as option, optionIndex (optionIndex)}
							<label class="flex cursor-pointer items-start gap-2 rounded border p-3">
								<input
									type="radio"
									name="standalone-poll-option"
									checked={selectedSet.has(optionIndex)}
									onchange={() => (draftSelectedOptionIndexes = [optionIndex])}
								/>
								<span>{option}</span>
							</label>
						{/each}
					</div>
				{:else}
					<div class="space-y-2">
						{#each poll.options as option, optionIndex (optionIndex)}
							<label
								class={`flex items-start gap-2 rounded border p-3 ${
									isOptionDisabled(optionIndex) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
								}`}
							>
								<input
									type="checkbox"
									checked={selectedSet.has(optionIndex)}
									disabled={isOptionDisabled(optionIndex)}
									onchange={() => toggleMultiOption(optionIndex)}
								/>
								<span>{option}</span>
							</label>
						{/each}
					</div>
					<p class="text-xs text-muted-foreground">
						Du kan välja upp till {poll.maxVotesPerVoter} alternativ.
					</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="rounded-md border px-3 py-2 text-sm font-medium"
						onclick={submitVote}
						disabled={!canSubmit || submitting}
					>
						{submitting ? 'Sparar...' : 'Skicka röst'}
					</button>
					<button
						type="button"
						class="rounded-md border px-3 py-2 text-sm font-medium"
						onclick={retractVote}
						disabled={submitting || !poll.hasVoted}
					>
						Ta bort min röst
					</button>
				</div>
			</section>
		{:else}
			<section class="space-y-3 rounded-md border p-4">
				<h2 class="text-lg font-semibold">Omröstningen är stängd</h2>
				<p class="text-sm text-muted-foreground">
					Den här omröstningen tar inte längre emot röster.
				</p>

				{#if poll.results}
					<div class="space-y-2">
						<h3 class="text-sm font-semibold">Resultat</h3>
						<ul class="space-y-1 text-sm">
							{#each poll.results.optionTotals as option (option.optionIndex)}
								<li class="flex items-center justify-between rounded border px-3 py-2">
									<span>{option.option}</span>
									<span>{option.votes} röster</span>
								</li>
							{/each}
						</ul>
						{#if poll.results.winners.length > 0}
							<p class="text-xs text-muted-foreground">
								Vinnare:
								{poll.results.winners.map((winner: { option: string }) => winner.option).join(', ')}
							</p>
						{/if}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Inga publika resultat finns ännu.</p>
				{/if}
			</section>
		{/if}
	{/if}
</main>
