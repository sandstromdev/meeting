<script lang="ts">
	import { api } from '$convex/_generated/api';
	import AddAgendaItem from '$lib/components/blocks/admin/agenda/edit-agenda-item.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { Input } from '$lib/components/ui/input';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import { cn } from '$lib/utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import SaveIcon from '@lucide/svelte/icons/save';
	import XIcon from '@lucide/svelte/icons/x';

	const meeting = getMeetingContext();
	const ps = usePageState();

	const flatAgenda = $derived(meeting.agenda.flat);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (flatAgenda.length > 0 ? flatAgenda[0].id : undefined),
	);

	const currentAgendaItemIndex = $derived(
		flatAgenda.findIndex((item) => item.id === currentAgendaItemId),
	);
	const currentAgendaItem = $derived(flatAgenda[currentAgendaItemIndex]);

	function hasBeenCompleted(index: number) {
		return currentAgendaItemIndex >= 0 && currentAgendaItemIndex > index;
	}

	function getSubtreeEnd(index: number) {
		const current = flatAgenda[index];
		if (!current) {
			return index + 1;
		}
		let cursor = index + 1;
		while (cursor < flatAgenda.length && flatAgenda[cursor].depth > current.depth) {
			cursor += 1;
		}
		return cursor;
	}

	function canMoveUp(index: number) {
		const current = flatAgenda[index];
		if (!current) {
			return false;
		}
		for (let i = index - 1; i >= 0; i--) {
			if (flatAgenda[i].depth < current.depth) {
				return false;
			}
			if (flatAgenda[i].depth === current.depth) {
				return true;
			}
		}
		return false;
	}

	function canMoveDown(index: number) {
		const current = flatAgenda[index];
		if (!current) {
			return false;
		}
		const nextSiblingIndex = getSubtreeEnd(index);
		if (nextSiblingIndex >= flatAgenda.length) {
			return false;
		}
		return flatAgenda[nextSiblingIndex].depth === current.depth;
	}

	function hasChildren(index: number) {
		const current = flatAgenda[index];
		const next = flatAgenda[index + 1];
		return !!current && !!next && next.depth > current.depth;
	}

	function removeAgendaItemWithChoice(itemId: string, index: number) {
		if (!hasChildren(index)) {
			confirm({
				title: 'Ta bort punkt?',
				description: 'Är du säker på att du vill ta bort denna punkt?',
				onConfirm: () =>
					meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
						agendaItemId: itemId,
						deletionMode: 'delete_subtree',
					}),
			});
			return;
		}

		confirm({
			title: 'Punkten har underpunkter',
			description: 'Vill du behålla underpunkterna och bara ta bort huvudpunkten?',
			confirm: { text: 'Behåll underpunkter' },
			cancel: { text: 'Ta bort allt' },
			onConfirm: () =>
				meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
					agendaItemId: itemId,
					deletionMode: 'keep_children',
				}),
			onCancel: () => {
				confirm({
					title: 'Ta bort punkt och underpunkter?',
					description: 'Detta tar bort punkten och alla underpunkter permanent.',
					confirm: { text: 'Ta bort alla' },
					cancel: { text: 'Avbryt' },
					onConfirm: () =>
						meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
							agendaItemId: itemId,
							deletionMode: 'delete_subtree',
						}),
				});
			},
		});
	}

	type AgendaDraft = {
		id: string;
		title: string;
	};

	let editingItem = $state<AgendaDraft | undefined>(undefined);

	async function saveAgendaItem() {
		if (!editingItem || !meeting.isAdmin) {
			return;
		}

		await meeting.adminMutate(api.admin.agenda.updateAgendaItem, {
			agendaItemId: editingItem.id,
			title: editingItem.title,
		});
		editingItem = undefined;
	}
</script>

<Collapsible class="rounded-lg border" open={ps.isDefault}>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
	>
		<h2 class="font-semibold">Dagordning</h2>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>

	<CollapsibleContent>
		<div class="border-t">
			{#if flatAgenda.length === 0}
				<p class="text-sm text-muted-foreground">Inga agendapunkter ännu.</p>
			{:else}
				<ol>
					{#each flatAgenda as item, index (item.id)}
						<li
							class={cn(
								'flex items-baseline gap-2 py-2 pr-2 text-sm not-last:border-b',
								hasBeenCompleted(index) && 'bg-muted/50 text-muted-foreground',
							)}
							style={`padding-left: ${item.depth * 1.25}rem;`}
						>
							<div class="w-[6ch] shrink-0 text-right text-muted-foreground">
								{item.number}.
							</div>
							{#if editingItem?.id !== item.id}
								<span class={cn('text-sm font-medium', hasBeenCompleted(index) && 'line-through')}>
									{item.title}
								</span>
							{:else}
								<Input bind:value={editingItem.title} placeholder="Rubrik" />
							{/if}

							{#if meeting.isAdmin}
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
										disabled={!canMoveUp(index)}
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
										disabled={!canMoveDown(index)}
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
											onclick={() => removeAgendaItemWithChoice(item.id, index)}
										>
											<XIcon class="size-4" />
										</Button>
									{:else}
										<Button
											size="icon"
											variant="ghost"
											type="button"
											onclick={() => (editingItem = item)}
										>
											<PencilIcon class="size-4" />
										</Button>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}

			{#if meeting.isAdmin}
				<AddAgendaItem />
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
