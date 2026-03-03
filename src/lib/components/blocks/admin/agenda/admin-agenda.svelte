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

	const agenda = $derived(meeting.meeting.agenda ?? []);
	const currentAgendaItemId = $derived(
		meeting.meeting.currentAgendaItemId ?? (agenda.length > 0 ? agenda[0].id : undefined),
	);

	const currentAgendaItemIndex = $derived(
		agenda.findIndex((item) => item.id === currentAgendaItemId),
	);
	const currentAgendaItem = $derived(agenda[currentAgendaItemIndex]);

	function hasBeenCompleted(number: number) {
		return currentAgendaItem?.number && currentAgendaItem.number > number;
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
			{#if agenda.length === 0}
				<p class="text-sm text-muted-foreground">Inga agendapunkter ännu.</p>
			{:else}
				<ol>
					{#each agenda as item (item.id)}
						<li
							class={cn(
								'flex items-baseline gap-2 py-2 pr-2 text-sm not-last:border-b',
								hasBeenCompleted(item.number) && 'bg-muted/50 text-muted-foreground',
							)}
						>
							<div class="w-[4ch] shrink-0 text-right text-muted-foreground">
								{item.number}.
							</div>
							{#if editingItem?.id !== item.id}
								<span
									class={cn('text-sm font-medium', hasBeenCompleted(item.number) && 'line-through')}
								>
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
											onclick={() =>
												confirm({
													title: 'Ta bort punkt?',
													description: 'Är du säker på att du vill ta bort denna punkt?',
													onConfirm: () =>
														meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
															agendaItemId: item.id,
														}),
												})}
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
