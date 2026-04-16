<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { createAgendaItem, updateAgendaItem } from '$lib/components/blocks/admin/agenda/agenda';
	import {
		hydratePollRowToDraft,
		newPollDraft,
		POLL_PRESETS,
		type MeetingPollDraft,
	} from '$lib/polls';
	import EditPolls from '$lib/components/blocks/admin/agenda/edit-polls.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SaveIcon from '@lucide/svelte/icons/save';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { SvelteMap } from 'svelte/reactivity';
	import { PollDrafts } from './agenda-poll-drafts.svelte';
	import EditSubItems from './edit-sub-items.svelte';

	const meeting = getMeetingContext();

	let {
		agendaItemId,
		onClose = () => {},
	}: {
		agendaItemId?: string;
		onClose?: () => unknown;
	} = $props();

	const flatAgenda = $derived(meeting.agenda.flat);
	const item = $derived(
		agendaItemId ? (flatAgenda.find((a) => a.id === agendaItemId) ?? null) : null,
	);
	const isEditMode = $derived(!!agendaItemId);

	const currentPollsResult = meeting.adminQuery(
		api.meeting.admin.meetingPoll.getPollsByAgendaItemId,
		() => (isEditMode && agendaItemId ? { agendaItemId } : 'skip'),
	);

	let newTitle = $state('');
	let newDescription = $state('');
	let polls = $state<MeetingPollDraft[]>([]);
	let lastSyncedId = $state<string | null>(null);
	let initialPollIds = $state<Id<'meetingPolls'>[]>([]);
	let originalPolls = new SvelteMap<Id<'meetingPolls'>, MeetingPollDraft>();

	const drafts = new PollDrafts(() => polls);

	$effect(() => {
		if (isEditMode && item && item.id !== lastSyncedId) {
			const currentPolls = currentPollsResult.data;

			lastSyncedId = item.id;
			newTitle = item.title;
			newDescription = item.description ?? '';

			if (!currentPolls) {
				return;
			}

			polls = currentPolls.map((p) => hydratePollRowToDraft(p));
			initialPollIds = currentPolls.map((p) => p._id);
			originalPolls.clear();

			for (const p of currentPolls) {
				originalPolls.set(p._id, hydratePollRowToDraft(p));
			}
		}

		if (!isEditMode) {
			lastSyncedId = null;
			newDescription = '';
		}
	});

	const canSubmit = $derived(!!newTitle.trim());

	async function submit() {
		const pollsValid = drafts.validate();

		if (!pollsValid.success) {
			const affected = new Set(pollsValid.error.issues.map((i) => (i.path[0] as number) + 1));
			toast.warning('Kontrollera fälten för omröstning ' + Array.from(affected).join(', '));
			return;
		}

		if (!canSubmit) {
			toast.warning('Ange en rubrik.');
			return;
		}

		try {
			if (isEditMode) {
				if (!agendaItemId) {
					toast.warning('Punkt hittades inte.');
					return;
				}

				await updateAgendaItem(meeting, {
					agendaItemId,
					title: newTitle.trim(),
					description: newDescription,
					polls: drafts.polls,
				});
			} else {
				await createAgendaItem(meeting, {
					title: newTitle.trim(),
					description: newDescription,
					polls: drafts.polls,
				});

				newTitle = '';
				newDescription = '';
				polls = [];
			}
			toast.success(isEditMode ? 'Agendapunkt sparad.' : 'Agendapunkt tillagd.');
			onClose?.();
		} catch (err) {
			console.error(err);
			toast.error('Kunde inte spara agendapunkten.');
		}
	}
</script>

{#if isEditMode && agendaItemId && !item}
	<p class="border-t p-4 text-sm text-muted-foreground">Punkt hittades inte.</p>
{:else}
	<div class="w-full space-y-4">
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-2">
				<Input bind:value={newTitle} placeholder="Rubrik" class="min-w-[12rem]" />
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline">
								<PlusIcon class="size-4" />
								Lägg till omröstning
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-max" align="center">
						<DropdownMenu.Label>Lägg till</DropdownMenu.Label>
						<DropdownMenu.Item onclick={() => drafts.addPollDraft(newPollDraft())}>
							Omröstning
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Label>Förval</DropdownMenu.Label>
							{#each POLL_PRESETS as option (option.name)}
								<DropdownMenu.Item onclick={() => drafts.addPollDraft(option.preset())}>
									{option.name}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<Button class="ml-auto" disabled={!canSubmit} onClickPromise={submit}>
					{#if isEditMode}
						<SaveIcon class="size-4" />
						Spara ändringar
					{:else}
						<PlusIcon class="size-4" />
						Lägg till punkt
					{/if}
				</Button>

				{#if isEditMode}
					<Button type="button" variant="outline" size="icon" onclick={() => onClose?.()}>
						<XIcon class="size-4" />
					</Button>
				{/if}
			</div>
			<div class="space-y-1">
				<label for="agenda-item-desc" class="text-sm font-medium">Beskrivning (valfritt)</label>
				<Textarea
					id="agenda-item-desc"
					bind:value={newDescription}
					placeholder="Visas på projektorn under den aktuella punkten (vanlig text)"
					rows={3}
					class="max-w-2xl resize-y"
				/>
			</div>
		</div>

		<EditPolls {drafts} />

		{#if isEditMode && item}
			<EditSubItems parentItemId={item.id} />
		{/if}
	</div>
{/if}
