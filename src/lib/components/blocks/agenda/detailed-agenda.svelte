<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { canMoveSubtree } from '$convex/helpers/agenda';
	import EditAgendaItem from '$lib/components/blocks/admin/agenda/edit-agenda-item.svelte';
	import { removeAgendaItemWithChoice } from '$lib/components/blocks/admin/agenda/helpers';
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import Agenda from './agenda.svelte';
	import AgendaItemDefaultMain from './agenda-item-default-main.svelte';
	import { canMoveDown, canMoveUp, type AgendaViewItem } from './agenda-helpers';

	const meeting = getMeetingContext();
	const ps = usePageState();

	const agendaFlat = $derived(meeting.agenda.flat);

	let editingItemId = $state<string | undefined>(undefined);
</script>

<Agenda
	flat={agendaFlat}
	currentAgendaItemId={meeting.agenda.currentAgendaItemId ?? null}
	initialOpen={meeting.isAdmin ? ps.isDefault : false}
	compactRows={meeting.isAdmin}
>
	{#snippet footer()}
		{#if meeting.isAdmin}
			<div class="border-t p-4">
				<EditAgendaItem />
			</div>
		{/if}
	{/snippet}
	{#snippet itemLeading(item: AgendaViewItem, _index: number)}
		{#if meeting.isAdmin}
			<Button
				size="icon"
				variant="ghost"
				disabled={item.id === meeting.agenda.currentAgendaItemId}
				type="button"
				onClickPromise={() =>
					meeting.adminMutate(api.meeting.admin.agenda.setCurrentAgendaItem, {
						agendaItemId: item.id,
					})}
			>
				<ChevronRightIcon class="size-4" />
			</Button>
		{/if}
	{/snippet}
	{#snippet itemMain(item: AgendaViewItem, index: number)}
		{#if meeting.isAdmin && editingItemId === item.id}
			<EditAgendaItem agendaItemId={item.id} onClose={() => (editingItemId = undefined)} />
		{:else}
			<AgendaItemDefaultMain {item} {index} currentIndex={meeting.agenda.currentIndex} />
		{/if}
	{/snippet}
	{#snippet itemActions(item: AgendaViewItem, index: number)}
		{#if meeting.isAdmin}
			<div class="ml-auto flex gap-0.5">
				{#if editingItemId !== item.id}
					<Button
						size="icon"
						variant="ghost"
						type="button"
						onClickPromise={() =>
							meeting.adminMutate(api.meeting.admin.agenda.moveAgendaItem, {
								agendaItemId: item.id,
								direction: 'in',
							})}
						disabled={!canMoveSubtree(agendaFlat, item.id, 'in')}
					>
						<ChevronRightIcon class="size-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						type="button"
						onClickPromise={() =>
							meeting.adminMutate(api.meeting.admin.agenda.moveAgendaItem, {
								agendaItemId: item.id,
								direction: 'out',
							})}
						disabled={!canMoveSubtree(agendaFlat, item.id, 'out')}
					>
						<ChevronLeftIcon class="size-4" />
					</Button>

					<Button
						size="icon"
						variant="ghost"
						type="button"
						onClickPromise={() =>
							meeting.adminMutate(api.meeting.admin.agenda.moveAgendaItem, {
								agendaItemId: item.id,
								direction: 'up',
							})}
						disabled={!canMoveUp(agendaFlat, index)}
					>
						<ChevronUpIcon class="size-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						type="button"
						onClickPromise={() =>
							meeting.adminMutate(api.meeting.admin.agenda.moveAgendaItem, {
								agendaItemId: item.id,
								direction: 'down',
							})}
						disabled={!canMoveDown(agendaFlat, index)}
					>
						<ChevronDownIcon class="size-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						type="button"
						onclick={() => (editingItemId = item.id)}
					>
						<PencilIcon class="size-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						class="text-destructive hover:bg-destructive/10 hover:text-destructive"
						type="button"
						onclick={() => removeAgendaItemWithChoice(meeting, item.id)}
					>
						<Trash2Icon class="size-4" />
					</Button>
				{/if}
			</div>
		{/if}
	{/snippet}
</Agenda>
