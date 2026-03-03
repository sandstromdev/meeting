<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { getMeetingContext } from '$lib/context.svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SaveIcon from '@lucide/svelte/icons/save';
	import XIcon from '@lucide/svelte/icons/x';

	type AgendaDraft = {
		id: string;

		title: string;
	};

	const meeting = getMeetingContext();
	const agenda = $derived(meeting.meeting.agenda ?? []);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (agenda.length > 0 ? agenda[0].id : undefined),
	);

	let newTitle = $state('');
	let isLoading = $state(false);

	let editingItem = $state<AgendaDraft | undefined>(undefined);

	function startEditing(item: AgendaDraft) {
		editingItem = item;
	}

	function stopEditing() {
		editingItem = undefined;
	}

	async function addAgendaItem() {
		isLoading = true;
		const title = newTitle.trim();
		if (!title) {
			return;
		}

		await meeting.adminMutate(api.admin.agenda.createAgendaItem, {
			title,
		});
		newTitle = '';
		isLoading = false;
	}

	async function saveAgendaItem() {
		if (!editingItem) {
			return;
		}

		await meeting.adminMutate(api.admin.agenda.updateAgendaItem, {
			agendaItemId: editingItem.id,
			title: editingItem.title,
		});
		stopEditing();
	}
</script>

<section class="rounded-lg border p-4">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="font-semibold">Dagordning</h2>
		<span class="text-xs text-muted-foreground">{agenda.length} punkter</span>
	</div>

	<div class="space-y-3">
		{#if agenda.length === 0}
			<p class="text-sm text-muted-foreground">Inga agendapunkter ännu.</p>
		{:else}
			{#each agenda as item (item.id)}
				<div class="flex items-center gap-2 rounded-md border p-2 text-sm">
					<div class="w-10 shrink-0 text-right text-muted-foreground">
						{item.number}.
					</div>
					{#if editingItem?.id !== item.id}
						<span class="text-sm font-medium">{item.title}</span>
					{:else}
						<Input bind:value={editingItem.title} placeholder="Rubrik" />
					{/if}

					<div class="ml-auto flex gap-0.5">
						<Button
							size="icon"
							variant="ghost"
							type="button"
							onClickPromise={() =>
								meeting.adminMutate(api.admin.agenda.moveAgendaItem, {
									agendaItemId: item.id,
									direction: 'up',
								})}
							disabled={item.number <= 1}
						>
							<ChevronUpIcon class="size-4" />
						</Button>

						<Button
							size="icon"
							variant="ghost"
							type="button"
							onClickPromise={() =>
								meeting.adminMutate(api.admin.agenda.moveAgendaItem, {
									agendaItemId: item.id,
									direction: 'down',
								})}
							disabled={item.number >= agenda.length}
						>
							<ChevronDownIcon class="size-4" />
						</Button>

						<Button
							size="icon"
							variant="ghost"
							disabled={item.id === currentAgendaItemId}
							type="button"
							onClickPromise={() =>
								meeting.adminMutate(api.admin.agenda.setCurrentAgendaItem, {
									agendaItemId: item.id,
								})}
						>
							<CheckIcon class="size-4" />
						</Button>

						{#if editingItem?.id === item.id}
							<Button
								size="icon"
								variant="ghost"
								type="button"
								onClickPromise={() => saveAgendaItem()}
							>
								<SaveIcon class="size-4" />
							</Button>

							<Button
								size="icon"
								variant="ghost"
								class="text-destructive hover:bg-destructive/10 hover:text-destructive"
								type="button"
								onClickPromise={() =>
									meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
										agendaItemId: item.id,
									})}
							>
								<XIcon class="size-4" />
							</Button>
						{:else}
							<Button size="icon" variant="ghost" type="button" onclick={() => startEditing(item)}>
								<PencilIcon class="size-4" />
							</Button>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<form class="mt-4 flex items-center gap-2 border-t pt-4" onsubmit={() => addAgendaItem}>
		<Input bind:value={newTitle} placeholder="Rubrik" />
		<Button type="submit" loading={isLoading} disabled={!newTitle.trim()} class="">
			<PlusIcon class="size-4" />
			Lägg till punkt
		</Button>
	</form>
</section>
