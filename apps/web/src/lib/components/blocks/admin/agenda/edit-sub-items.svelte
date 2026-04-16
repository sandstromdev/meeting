<script lang="ts">
	import { api } from '@lsnd/convex/_generated/api';
	import { notifyMutation } from '$lib/admin-toast';
	import EditAgendaItem from '$lib/components/blocks/admin/agenda/edit-agenda-item.svelte';
	import {
		getChildren,
		removeAgendaItemWithChoice,
	} from '$lib/components/blocks/admin/agenda/helpers';
	import { Button } from '$lib/components/ui/button';
	import CollapsibleContent from '$lib/components/ui/collapsible/collapsible-content.svelte';
	import CollapsibleTrigger from '$lib/components/ui/collapsible/collapsible-trigger.svelte';
	import Collapsible from '$lib/components/ui/collapsible/collapsible.svelte';
	import { Input } from '$lib/components/ui/input';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';

	const meeting = getMeetingContext();

	let {
		parentItemId,
	}: {
		parentItemId: string;
	} = $props();

	const subItems = $derived(getChildren(meeting.agenda.flat, parentItemId));

	let newSubItemTitle = $state('');
	let expandedSubItemId = $state<string | null>(null);

	async function addSubItem() {
		if (!parentItemId || !newSubItemTitle.trim()) {
			toast.warning('Ange en titel för underpunkten.');
			return;
		}
		await notifyMutation(
			'Underpunkt tillagd.',
			() =>
				meeting.adminMutate(api.meeting.admin.agenda.createAgendaItem, {
					title: newSubItemTitle.trim(),
					parentId: parentItemId,
					polls: [],
				}),
			{ rethrow: true },
		);
		newSubItemTitle = '';
	}

	function toggleExpand(id: string) {
		expandedSubItemId = expandedSubItemId === id ? null : id;
	}
</script>

<div class="border-t pt-4">
	<p class="text-sm font-medium text-muted-foreground">Underpunkter</p>

	{#if subItems.length > 0}
		<ul class="mt-2 space-y-2">
			{#each subItems as sub (sub.id)}
				<li>
					<Collapsible
						open={expandedSubItemId === sub.id}
						onOpenChange={(open) => {
							expandedSubItemId = open ? sub.id : null;
						}}
					>
						<div class="flex items-center gap-2 rounded-md border bg-muted/20 p-2">
							<CollapsibleTrigger
								type="button"
								class="flex flex-1 items-center gap-2 text-left text-sm hover:opacity-80"
							>
								{#if expandedSubItemId === sub.id}
									<ChevronDownIcon class="size-4 shrink-0 text-muted-foreground" />
								{:else}
									<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" />
								{/if}
								<span class="flex-1">{sub.title}</span>
							</CollapsibleTrigger>
							{#if expandedSubItemId !== sub.id}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={() => toggleExpand(sub.id)}
									aria-label="Redigera underpunkt"
								>
									<PencilIcon class="size-4" />
								</Button>
							{/if}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="text-destructive hover:bg-destructive/10 hover:text-destructive"
								onclick={() => removeAgendaItemWithChoice(meeting, sub.id)}
							>
								<Trash2Icon class="size-4" />
							</Button>
						</div>
						<CollapsibleContent>
							<div class="mt-2 rounded-md border bg-muted/10 p-4">
								<EditAgendaItem agendaItemId={sub.id} />
							</div>
						</CollapsibleContent>
					</Collapsible>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-4">
		<p class="mb-2 text-sm font-medium text-muted-foreground">Lägg till underpunkt</p>
		<div class="flex flex-wrap items-center gap-2">
			<Input bind:value={newSubItemTitle} placeholder="Titel underpunkt" class="min-w-[12rem]" />
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={addSubItem}
				disabled={!newSubItemTitle.trim()}
			>
				<PlusIcon class="size-4" />
				Lägg till underpunkt
			</Button>
		</div>
	</div>
</div>
