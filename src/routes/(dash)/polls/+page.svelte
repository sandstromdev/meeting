<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import { toast } from 'svelte-sonner';

	const convex = useConvexClient();
	const currentUser = useQuery(api.me.getCurrentUser);
	const standaloneApi = api.public.standalone_poll;
	const standaloneAdminApi = api.admin.standalone_poll;
	const ownedPolls = useQuery(standaloneApi.get_my_owned_polls);

	let title = $state('');
	let optionsText = $state('');
	let type = $state<'single_winner' | 'multi_winner'>('single_winner');
	let winningCount = $state(1);
	let majorityRule = $state<'simple' | 'two_thirds' | 'three_quarters' | 'unanimous'>('simple');
	let maxVotesPerVoter = $state(1);
	let allowsAbstain = $state(false);
	let isResultPublic = $state(true);
	let visibilityMode = $state<'public' | 'account_required'>('public');

	let creating = $state(false);
	let actionLoadingPollId = $state<string | null>(null);
	let actionLoadingType = $state<string | null>(null);

	const user = $derived(currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');
	const polls = $derived(ownedPolls.data ?? []);

	function resetForm() {
		title = '';
		optionsText = '';
		type = 'single_winner';
		winningCount = 1;
		majorityRule = 'simple';
		maxVotesPerVoter = 1;
		allowsAbstain = false;
		isResultPublic = true;
		visibilityMode = 'public';
	}

	async function createPoll(event: SubmitEvent) {
		event.preventDefault();
		if (creating) {
			return;
		}

		const options = optionsText
			.split('\n')
			.map((value) => value.trim())
			.filter((value) => value.length > 0);

		if (!title.trim()) {
			toast.error('Ange en titel.');
			return;
		}

		if (options.length < 2) {
			toast.error('Ange minst två alternativ.');
			return;
		}

		creating = true;
		try {
			await convex.mutation(standaloneAdminApi.create_poll, {
				draft: {
					title: title.trim(),
					options,
					type,
					winningCount: Math.max(1, Number(winningCount)),
					majorityRule,
					maxVotesPerVoter: Math.max(1, Number(maxVotesPerVoter)),
					allowsAbstain,
					isResultPublic,
				},
				visibilityMode,
			});
			toast.success('Omröstningen skapades.');
			resetForm();
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte skapa omröstningen.');
		} finally {
			creating = false;
		}
	}

	async function withPollAction(
		pollId: string,
		action: 'open' | 'close' | 'cancel' | 'remove',
		fn: () => Promise<unknown>,
		successMessage: string,
	) {
		if (actionLoadingPollId) {
			return;
		}
		actionLoadingPollId = pollId;
		actionLoadingType = action;
		try {
			await fn();
			toast.success(successMessage);
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte uppdatera omröstningen.');
		} finally {
			actionLoadingPollId = null;
			actionLoadingType = null;
		}
	}
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
	<h1 class="text-2xl font-semibold">Fristående omröstningar</h1>

	{#if user === null}
		<div class="rounded-md border p-4 text-sm">
			Du behöver vara inloggad för att skapa och hantera fristående omröstningar.
			<a href={resolve(`/sign-in?redirect=${encodeURIComponent('/polls')}`)} class="underline"
				>Logga in</a
			>.
		</div>
	{:else if !isAdmin}
		<div class="rounded-md border p-4 text-sm">
			Endast administratörer kan skapa och hantera fristående omröstningar.
		</div>
	{:else}
		<section class="rounded-md border p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-medium">Skapa omröstning</h2>
			<form class="flex flex-col gap-4" onsubmit={createPoll}>
				<div class="flex flex-col gap-1">
					<label for="title" class="text-sm font-medium">Titel</label>
					<input
						id="title"
						class="rounded-md border px-3 py-2 text-sm"
						type="text"
						bind:value={title}
						placeholder="Till exempel: Val av mötesordförande"
						required
					/>
				</div>

				<div class="flex flex-col gap-1">
					<label for="options" class="text-sm font-medium">Alternativ (en rad per alternativ)</label
					>
					<textarea
						id="options"
						class="min-h-32 rounded-md border px-3 py-2 text-sm"
						bind:value={optionsText}
						placeholder="Alternativ 1&#10;Alternativ 2"
						required
					></textarea>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1">
						<label for="type" class="text-sm font-medium">Typ</label>
						<select id="type" class="rounded-md border px-3 py-2 text-sm" bind:value={type}>
							<option value="single_winner">En vinnare</option>
							<option value="multi_winner">Flera vinnare</option>
						</select>
					</div>

					<div class="flex flex-col gap-1">
						<label for="winningCount" class="text-sm font-medium">Antal vinnare</label>
						<input
							id="winningCount"
							class="rounded-md border px-3 py-2 text-sm"
							type="number"
							min="1"
							step="1"
							bind:value={winningCount}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<label for="majorityRule" class="text-sm font-medium">Majoritetsregel</label>
						<select
							id="majorityRule"
							class="rounded-md border px-3 py-2 text-sm"
							bind:value={majorityRule}
						>
							<option value="simple">Enkel majoritet</option>
							<option value="two_thirds">Två tredjedelar</option>
							<option value="three_quarters">Tre fjärdedelar</option>
							<option value="unanimous">Enhälligt</option>
						</select>
					</div>

					<div class="flex flex-col gap-1">
						<label for="maxVotesPerVoter" class="text-sm font-medium">Max röster per väljare</label>
						<input
							id="maxVotesPerVoter"
							class="rounded-md border px-3 py-2 text-sm"
							type="number"
							min="1"
							step="1"
							bind:value={maxVotesPerVoter}
						/>
					</div>

					<div class="flex flex-col gap-1">
						<label for="visibilityMode" class="text-sm font-medium">Synlighetsläge</label>
						<select
							id="visibilityMode"
							class="rounded-md border px-3 py-2 text-sm"
							bind:value={visibilityMode}
						>
							<option value="public">Publik</option>
							<option value="account_required">Konto krävs</option>
						</select>
					</div>
				</div>

				<div class="grid gap-3 sm:grid-cols-3">
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={allowsAbstain} />
						Tillåt avstår
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={isResultPublic} />
						Resultat är publikt
					</label>
				</div>

				<div>
					<button
						type="submit"
						class="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
						disabled={creating}
					>
						{creating ? 'Skapar...' : 'Skapa omröstning'}
					</button>
				</div>
			</form>
		</section>

		<section class="rounded-md border p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-medium">Mina omröstningar</h2>
			<div class="flex flex-col gap-3">
				{#if polls.length === 0}
					<p class="text-sm text-muted-foreground">Du har inga fristående omröstningar ännu.</p>
				{:else}
					{#each polls as poll (poll._id)}
						<article class="rounded-md border p-3">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<h3 class="truncate font-medium">{poll.title}</h3>
									<p class="text-sm text-muted-foreground">
										Kod:
										<a href={resolve(`/p/${poll.code}`)} class="underline">{poll.code}</a>
										{poll.isOpen ? ' - Öppen' : ' - Stängd'}
									</p>
								</div>
								<div class="flex flex-wrap gap-2">
									{#if poll.isOpen}
										<button
											type="button"
											class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'close',
													() =>
														convex.mutation(standaloneAdminApi.close_poll, {
															pollId: poll._id,
														}),
													'Omröstningen stängdes.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'close'
												? 'Stänger...'
												: 'Stäng'}
										</button>
										<button
											type="button"
											class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'cancel',
													() =>
														convex.mutation(standaloneAdminApi.cancel_poll, {
															pollId: poll._id,
														}),
													'Omröstningen avbröts.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'cancel'
												? 'Avbryter...'
												: 'Avbryt'}
										</button>
									{:else}
										<button
											type="button"
											class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'open',
													() =>
														convex.mutation(standaloneAdminApi.open_poll, {
															pollId: poll._id,
														}),
													'Omröstningen öppnades.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'open'
												? 'Öppnar...'
												: 'Öppna'}
										</button>
										<button
											type="button"
											class="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
											disabled={actionLoadingPollId === poll._id}
											onclick={() =>
												withPollAction(
													poll._id,
													'remove',
													() =>
														convex.mutation(standaloneAdminApi.remove_poll, {
															pollId: poll._id,
														}),
													'Omröstningen togs bort.',
												)}
										>
											{actionLoadingPollId === poll._id && actionLoadingType === 'remove'
												? 'Tar bort...'
												: 'Ta bort'}
										</button>
									{/if}
								</div>
							</div>
						</article>
					{/each}
				{/if}
			</div>
		</section>
	{/if}
</div>
