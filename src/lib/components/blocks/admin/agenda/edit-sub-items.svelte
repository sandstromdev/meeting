<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import Collapsible from '$lib/components/ui/collapsible/collapsible.svelte';
	import CollapsibleContent from '$lib/components/ui/collapsible/collapsible-content.svelte';
	import CollapsibleTrigger from '$lib/components/ui/collapsible/collapsible-trigger.svelte';
	import { confirm, confirmAsync } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { Input } from '$lib/components/ui/input';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import EditSubItem from './edit-sub-item.svelte';

	const meeting = getMeetingContext();

	let {
		parentItemId,
		parentDepth,
	}: {
		parentItemId: string;
		parentDepth: number;
	} = $props();

	const flatAgenda = $derived(meeting.agenda.flat);
	const subItems = $derived.by(() => {
		const start = flatAgenda.findIndex((item) => item.id === parentItemId);
		if (start < 0) {
			return [];
		}
		const out: { id: string; title: string }[] = [];
		for (let i = start + 1; i < flatAgenda.length; i++) {
			const candidate = flatAgenda[i];
			if (candidate.depth <= parentDepth) {
				break;
			}
			if (candidate.depth === parentDepth + 1) {
				out.push({
					id: candidate.id,
					title: candidate.title,
				});
			}
		}
		return out;
	});

	let newSubItemTitle = $state('');
	let expandedSubItemId = $state<string | null>(null);

	async function addSubItem() {
		if (!parentItemId || !newSubItemTitle.trim()) {
			return;
		}
		await meeting.adminMutate(api.admin.agenda.createAgendaItem, {
			title: newSubItemTitle.trim(),
			parentId: parentItemId,
		});
		newSubItemTitle = '';
	}

	function toggleExpand(id: string) {
		expandedSubItemId = expandedSubItemId === id ? null : id;
	}

	function hasChildren(itemId: string) {
		const index = flatAgenda.findIndex((item) => item.id === itemId);
		if (index < 0) {
			return false;
		}
		const current = flatAgenda[index];
		const next = flatAgenda[index + 1];
		return !!next && next.depth > current.depth;
	}

	async function removeAgendaItemWithChoice(itemId: string) {
		if (!hasChildren(itemId)) {
			confirm({
				title: 'Ta bort underpunkt?',
				description: 'Är du säker på att du vill ta bort denna underpunkt?',
				onConfirm: () =>
					meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
						agendaItemId: itemId,
						deletionMode: 'delete_subtree',
					}),
			});
			return;
		}

		const keepChildren = await confirmAsync({
			title: 'Underpunkten har egna underpunkter',
			description: 'Vill du behålla dessa underpunkter och bara ta bort den valda raden?',
			confirm: { text: 'Behåll underpunkter' },
			cancel: { text: 'Ta bort allt' },
		});

		if (keepChildren) {
			await meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
				agendaItemId: itemId,
				deletionMode: 'keep_children',
			});
			return;
		}

		const deleteAll = await confirmAsync({
			title: 'Ta bort underpunkt och alla underpunkter?',
			description: 'Detta tar bort allt under denna punkt permanent.',
			confirm: { text: 'Ta bort alla' },
			cancel: { text: 'Avbryt' },
		});

		if (!deleteAll) {
			return;
		}

		await meeting.adminMutate(api.admin.agenda.removeAgendaItem, {
			agendaItemId: itemId,
			deletionMode: 'delete_subtree',
		});
	}
</script>

<div class="border-t pt-4">
	<p class="text-sm font-medium text-muted-foreground">Underpunkter</p>

	{#if subItems.length > 0}
		<ul class="mt-2 space-y-1">
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
								onclick={() => removeAgendaItemWithChoice(sub.id)}
							>
								<Trash2Icon class="size-4" />
							</Button>
						</div>
						<CollapsibleContent>
							<div class="mt-2 rounded-md border border-t-0 bg-muted/10 p-4">
								<EditSubItem
									subItem={sub}
									onClose={() => {
										expandedSubItemId = null;
									}}
								/>
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
