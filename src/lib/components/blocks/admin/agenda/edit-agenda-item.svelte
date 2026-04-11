<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { agendaItemMotionSettings } from '$convex/helpers/agenda';
	import { createAgendaItem, updateAgendaItem } from '$lib/components/blocks/admin/agenda/agenda';
	import {
		hydratePollRowToDraft,
		newPollDraft,
		POLL_PRESETS,
		type MeetingPollDraft,
	} from '$lib/polls';
	import EditPolls from '$lib/components/blocks/admin/agenda/edit-polls.svelte';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
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

	let allowMotionsState = $state(false);
	let motionSubmissionModeState = $state<'open' | 'amendments_only'>('open');

	let motionAddTitle = $state('');
	let motionAddText = $state('');
	let motionAmendSelect = $state('');

	const drafts = new PollDrafts(() => polls);

	const approvedMotionsResult = meeting.adminQuery(
		api.meeting.admin.motions.listApprovedForAgendaItem,
		() => (isEditMode && agendaItemId ? { agendaItemId } : 'skip'),
	);
	const approvedMotions = $derived(approvedMotionsResult.data ?? []);

	$effect(() => {
		if (!isEditMode || !item) {
			if (!isEditMode) {
				allowMotionsState = false;
				motionSubmissionModeState = 'open';
			}
			return;
		}
		const ms = agendaItemMotionSettings(item);
		allowMotionsState = ms.allowMotions;
		motionSubmissionModeState = ms.motionSubmissionMode;
	});

	const adminMotionFormKey = $derived(agendaItemId ?? '');
	$effect(() => {
		void adminMotionFormKey;
		motionAddTitle = '';
		motionAddText = '';
		motionAmendSelect = '';
	});

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
					allowMotions: allowMotionsState,
					motionSubmissionMode: motionSubmissionModeState,
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

	async function addAdminMotion() {
		if (!agendaItemId || !item) {
			return;
		}
		if (!motionAmendSelect && !motionAddTitle.trim()) {
			toast.warning(
				'Ange rubrik för ett nytt yrkande, eller välj tillägg till befintligt yrkande.',
			);
			return;
		}
		if (!motionAddText.trim()) {
			toast.warning('Ange text för yrkandet.');
			return;
		}
		try {
			await meeting.adminMutate(api.meeting.admin.motions.createMotion, {
				agendaItemId,
				title: motionAddTitle.trim() || undefined,
				text: motionAddText.trim(),
				...(motionAmendSelect ? { amendsMotionId: motionAmendSelect as Id<'meetingMotions'> } : {}),
				approveImmediately: true,
			});
			toast.success('Yrkande tillagt och godkänt.');
			motionAddTitle = '';
			motionAddText = '';
			motionAmendSelect = '';
		} catch (e) {
			console.error(e);
			toast.error('Kunde inte lägga till yrkandet.');
		}
	}

	function convertDescriptionToMotion() {
		if (!agendaItemId || !item?.description?.trim()) {
			return;
		}
		void confirm({
			title: 'Konvertera beskrivning till yrkande?',
			description:
				'Beskrivningen blir yrkandets text, godkänns direkt och en ja/nej-omröstning skapas. Beskrivningen tas bort från punkten.',
			onConfirm: async () => {
				try {
					await meeting.adminMutate(api.meeting.admin.motions.convertAgendaDescriptionToMotion, {
						agendaItemId,
						title: newTitle.trim() || undefined,
					});
					newDescription = '';
					toast.success('Beskrivning konverterad till yrkande.');
				} catch (e) {
					console.error(e);
					toast.error('Kunde inte konvertera.');
				}
			},
		});
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
					placeholder="Visas på projektorn under den aktuella punkten (markdown)"
					rows={3}
					class="max-w-2xl resize-y"
				/>
			</div>

			{#if isEditMode && item}
				<div class="flex max-w-2xl flex-col gap-3 rounded-md border p-3">
					<div class="flex flex-wrap items-center gap-3">
						<Switch bind:checked={allowMotionsState} id="allow-motions" />
						<Label for="allow-motions" class="cursor-pointer font-medium">
							Tillåt yrkanden (aktuell punkt)
						</Label>
					</div>
					{#if allowMotionsState}
						<div class="space-y-1">
							<Label for="motion-submission-mode">Yrkandeläge för deltagare</Label>
							<select
								id="motion-submission-mode"
								bind:value={motionSubmissionModeState}
								class="flex h-9 max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
							>
								<option value="open">Nya yrkanden och tillägg</option>
								<option value="amendments_only">Endast tillägg till godkända yrkanden</option>
							</select>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<EditPolls {drafts} />

		{#if isEditMode && item}
			<div class="space-y-3 rounded-md border p-4">
				<h3 class="text-sm font-semibold">Yrkanden (admin)</h3>
				{#if newDescription.trim()}
					<Button type="button" variant="outline" size="sm" onclick={convertDescriptionToMotion}>
						Konvertera beskrivning till yrkande
					</Button>
					<p class="text-xs text-muted-foreground">
						Godkänns direkt, skapar ja/nej-omröstning och rensar beskrivningen. Rubrik ovan används
						som yrkanderubrik om du fyller i den.
					</p>
				{/if}
				<div class="grid max-w-2xl gap-2">
					<Label for="admin-motion-amend">Tillägg till yrkande (valfritt)</Label>
					<select
						id="admin-motion-amend"
						bind:value={motionAmendSelect}
						class="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<option value="">— Nytt yrkande —</option>
						{#each approvedMotions as m (m._id)}
							<option value={m._id}>{m.title}</option>
						{/each}
					</select>
					<Label for="admin-motion-title">Rubrik</Label>
					<Input
						id="admin-motion-title"
						bind:value={motionAddTitle}
						placeholder="Krävs för nytt yrkande utan tillägg"
					/>
					<Label for="admin-motion-text">Text (markdown)</Label>
					<Textarea
						id="admin-motion-text"
						bind:value={motionAddText}
						rows={4}
						class="resize-y font-mono text-sm"
					/>
					<Button type="button" variant="secondary" onClickPromise={addAdminMotion}>
						Lägg till yrkande (godkänns direkt)
					</Button>
				</div>
				{#if approvedMotions.length > 0}
					<div class="text-sm text-muted-foreground">
						<p class="font-medium text-foreground">Godkända på denna punkt</p>
						<ul class="mt-1 list-inside list-disc">
							{#each approvedMotions as m (m._id)}
								<li>{m.title}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
			<EditSubItems parentItemId={item.id} />
		{/if}
	</div>
{/if}
