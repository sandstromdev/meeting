<script lang="ts">
	import { api } from '$convex/_generated/api';
	import EditAgendaItem from '$lib/components/blocks/admin/agenda/edit-agenda-item.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import { cn } from '$lib/utils';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const meeting = getMeetingContext();
	const ps = usePageState();
	const as = meeting.agenda;

	const agenda = $derived(as.flat);

	function hasBeenCompleted(id: string) {
		const index = agenda.findIndex((item) => item.id === id);
		return as.currentIndex >= 0 && as.currentIndex > index;
	}

	const mainStart = $derived(Math.max(0, as.currentIndex - 1));
	const mainEnd = $derived(
		as.currentIndex < 0 ? agenda.length : Math.min(agenda.length, as.currentIndex + 3),
	);
	const parts = $derived({
		previous: agenda.slice(0, mainStart),
		main: agenda.slice(mainStart, mainEnd),
		upcoming: agenda.slice(mainEnd),
	});

	let editingItemId = $state<string | undefined>(undefined);
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
				{#if parts.previous.length > 0}
					<Collapsible class="">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between border-b p-4 text-left text-sm hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
						>
							<span class="text-muted-foreground">Tidigare punkter ({parts.previous.length})</span>
							<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
						</CollapsibleTrigger>
						<CollapsibleContent>
							<ol class="border-t">
								{#each parts.previous as item, i (item.id)}
									{@render itemRow(item, i)}
								{/each}
							</ol>
						</CollapsibleContent>
					</Collapsible>
				{/if}

				<ol>
					{#each parts.main as item, i (item.id)}
						{@render itemRow(item, mainStart + i)}
					{/each}
				</ol>

				{#if parts.upcoming.length > 0}
					<Collapsible class="border-t">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between  p-4 text-left text-sm hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
						>
							<span class="text-muted-foreground">Kommande punkter ({parts.upcoming.length})</span>
							<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
						</CollapsibleTrigger>
						<CollapsibleContent>
							<ol class="border-t">
								{#each parts.upcoming as item, i (item.id)}
									{@render itemRow(item, mainEnd + i)}
								{/each}
							</ol>
						</CollapsibleContent>
					</Collapsible>
				{/if}
			{/if}

			{#if meeting.isAdmin}
				<div class="border-t p-4">
					<EditAgendaItem />
				</div>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>

{#snippet itemRow(item: (typeof agenda)[number], index: number)}
	<li class="">
		<div
			class={cn(
				'flex gap-2 border-b px-2 py-2 text-sm',
				hasBeenCompleted(item.id) && 'bg-muted/50 text-muted-foreground',
			)}
		>
			{#if meeting.isAdmin}
				<Button
					size="icon"
					variant="ghost"
					disabled={item.id === as.currentAgendaItemId}
					type="button"
					onClickPromise={() =>
						meeting.adminMutate(api.admin.agenda.setCurrentAgendaItem, {
							agendaItemId: item.id,
						})}
				>
					<ChevronRightIcon class="size-4" />
				</Button>
			{/if}
			{#if editingItemId === item.id}
				<EditAgendaItem agendaItemId={item.id} onClose={() => (editingItemId = undefined)} />
			{:else}
				<span class="flex shrink-0 items-baseline font-mono text-muted-foreground">
					{item.number}.
				</span>
				<span class={cn('text-sm font-medium', hasBeenCompleted(item.id) && 'line-through')}>
					{item.title}
				</span>
			{/if}
			{#if meeting.isAdmin}
				<div class="ml-auto flex gap-0.5">
					{#if editingItemId !== item.id}
						<Button
							size="icon"
							variant="ghost"
							type="button"
							onClickPromise={() =>
								meeting.adminMutate(api.admin.agenda.moveAgendaItem, {
									agendaItemId: item.id,
									direction: 'up',
								})}
							disabled={index <= 0}
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
							disabled={index >= agenda.length - 1}
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
							<Trash2Icon class="size-4" />
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</li>
{/snippet}
