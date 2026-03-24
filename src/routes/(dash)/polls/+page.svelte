<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import { useConvexClient, useQuery } from '@mmailaender/convex-svelte';
	import CreatePoll from './create-poll.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const convex = useConvexClient();
	const standaloneApi = api.public.standalone_poll;
	const standaloneAdminApi = api.admin.standalone_poll;
	const ownedPolls = useQuery(standaloneApi.get_my_owned_polls);

	let actionLoadingPollId = $state<string | null>(null);
	let actionLoadingType = $state<string | null>(null);

	const user = $derived(data.currentUser.data);
	const isAdmin = $derived(user?.role === 'admin');

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
		<CreatePoll />

		<section class="rounded-md border p-4 sm:p-5">
			<h2 class="mb-4 text-lg font-medium">Mina omröstningar</h2>
			<div class="flex flex-col gap-3">
				{#if ownedPolls.isLoading}
					<p class="text-sm text-muted-foreground">Laddar omröstningar...</p>
				{:else if !ownedPolls.data?.length}
					<p class="text-sm text-muted-foreground">Du har inga fristående omröstningar ännu.</p>
				{:else}
					{#each ownedPolls.data as poll (poll._id)}
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
