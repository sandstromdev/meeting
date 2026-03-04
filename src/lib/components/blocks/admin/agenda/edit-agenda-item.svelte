<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { Input } from '$lib/components/ui/input';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SaveIcon from '@lucide/svelte/icons/save';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import EditPoll from './edit-poll.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const meeting = getMeetingContext();

	type PollDraft = {
		id?: Id<'polls'>;
		title: string;
		options: string[];
		resultsPublic: boolean;
	maxVotesPerVoter: number;
	};

	let {
		agendaItemId,
		onClose = () => {},
	}: {
		agendaItemId?: string;
		onClose?: () => unknown;
	} = $props();

	const agenda = $derived(meeting.meeting.agenda ?? []);
	const item = $derived(agendaItemId ? agenda.find((a) => a.id === agendaItemId) : null);
	const isEditMode = $derived(!!agendaItemId);

	function newPollDraft() {
		return {
			title: '',
			options: ['', ''],
			resultsPublic: false,
			maxVotesPerVoter: 1,
		} satisfies PollDraft;
	}

	let newTitle = $state('');
	let polls = $state<PollDraft[]>([]);
	let isLoading = $state(false);
	let lastSyncedId = $state<string | null>(null);
	let initialPollIds = $state<Id<'polls'>[]>([]);
	let originalPolls = new SvelteMap<Id<'polls'>, PollDraft>();

	$effect(() => {
		if (isEditMode && item && item.id !== lastSyncedId) {
			lastSyncedId = item.id;
			newTitle = item.title;
			polls = item.polls.map((p) => ({
				id: p.id,
				title: p.title,
				options: [...p.options],
				resultsPublic: p.resultsPublic,
				maxVotesPerVoter: p.maxVotesPerVoter ?? 1,
			}));
			initialPollIds = item.polls.map((p) => p.id as Id<'polls'>);
			originalPolls.clear();

			for (const p of item.polls) {
				originalPolls.set(p.id, {
					title: p.title,
					options: [...p.options],
					resultsPublic: p.resultsPublic,
					maxVotesPerVoter: p.maxVotesPerVoter ?? 1,
				});
			}
		}

		if (!isEditMode) {
			lastSyncedId = null;
		}
	});

	const pollsValid = $derived(
		polls.every((p) => {
			const options = p.options.map((o) => o.trim()).filter(Boolean);
			return (
				!!p.title.trim() &&
				options.length >= 2 &&
				p.maxVotesPerVoter >= 1 &&
				p.maxVotesPerVoter <= options.length
			);
		}),
	);
	const canSubmit = $derived(!!newTitle.trim() && (polls.length === 0 || pollsValid));

	function addPollDraft() {
		polls = [...polls, newPollDraft()];
	}

	function movePollUp(index: number) {
		if (index <= 0) {
			return;
		}
		polls = [
			...polls.slice(0, index - 1),
			polls[index],
			polls[index - 1],
			...polls.slice(index + 1),
		];
	}

	function movePollDown(index: number) {
		if (index >= polls.length - 1) {
			return;
		}
		polls = [...polls.slice(0, index), polls[index + 1], polls[index], ...polls.slice(index + 2)];
	}

	function removePollDraft(index: number) {
		polls = polls.filter((_, i) => i !== index);
	}

	function optionsEqual(a: string[], b: string[]) {
		const ta = a.map((x) => x.trim()).filter(Boolean);
		const tb = b.map((x) => x.trim()).filter(Boolean);
		return ta.length === tb.length && ta.every((x, i) => x === tb[i]);
	}

	function draftChanged(draft: PollDraft): boolean {
		if (!draft.id) {
			return false;
		}
		const orig = originalPolls.get(draft.id);
		if (!orig) {
			return false;
		}
		return (
			orig.title !== draft.title.trim() ||
			!optionsEqual(orig.options, draft.options) ||
			orig.resultsPublic !== draft.resultsPublic ||
			orig.maxVotesPerVoter !== draft.maxVotesPerVoter
		);
	}

	async function submitCreate() {
		const created = await meeting.adminMutate(api.admin.agenda.createAgendaItem, {
			title: newTitle.trim(),
		});

		for (const poll of polls) {
			const options = poll.options.map((o) => o.trim()).filter(Boolean);
			if (poll.title.trim() && options.length >= 2) {
				await meeting.adminMutate(api.admin.poll.createPoll, {
					agendaItemId: created.id,
					title: poll.title.trim(),
					options,
					resultsPublic: poll.resultsPublic,
					maxVotesPerVoter: Math.min(poll.maxVotesPerVoter, options.length),
				});
			}
		}

		newTitle = '';
		polls = [];
	}

	async function submitEdit() {
		if (!agendaItemId) {
			return;
		}

		await meeting.adminMutate(api.admin.agenda.updateAgendaItem, {
			agendaItemId,
			title: newTitle.trim(),
		});

		const removedIds = initialPollIds.filter((id) => !polls.some((d) => d.id === id));

		for (const id of removedIds) {
			await meeting.adminMutate(api.admin.poll.removePoll, { pollId: id });
		}

		const orderedIds: Id<'polls'>[] = [];

		for (const draft of polls) {
			if (draft.id) {
				orderedIds.push(draft.id);
			} else {
				const options = draft.options.map((o) => o.trim()).filter(Boolean);
				if (draft.title.trim() && options.length >= 2) {
					const pollId = await meeting.adminMutate(api.admin.poll.createPoll, {
						agendaItemId,
						title: draft.title.trim(),
						options,
						resultsPublic: draft.resultsPublic,
						maxVotesPerVoter: Math.min(draft.maxVotesPerVoter, options.length),
					});
					orderedIds.push(pollId);
				}
			}
		}

		await meeting.adminMutate(api.admin.agenda.setAgendaItemPollIds, {
			agendaItemId,
			pollIds: orderedIds,
		});

		for (const draft of polls) {
			if (draft.id && draftChanged(draft)) {
				const options = draft.options.map((o) => o.trim()).filter(Boolean);
				if (options.length >= 2) {
					await meeting.adminMutate(api.admin.poll.editPoll, {
						pollId: draft.id,
						title: draft.title.trim(),
						options,
						resultsPublic: draft.resultsPublic,
						maxVotesPerVoter: Math.min(draft.maxVotesPerVoter, options.length),
					});
				}
			}
		}
	}

	async function onsubmit(e: Event) {
		e.preventDefault();
		if (!canSubmit) {
			return;
		}
		isLoading = true;

		if (isEditMode) {
			await submitEdit();
		} else {
			await submitCreate();
		}

		onClose?.();

		isLoading = false;
	}
</script>

{#if isEditMode && agendaItemId && !item}
	<p class="border-t p-4 text-sm text-muted-foreground">Punkt hittades inte.</p>
{:else}
	<form class="w-full space-y-4" {onsubmit}>
		<div class="flex flex-wrap items-center gap-2">
			<Input bind:value={newTitle} placeholder="Rubrik" class="min-w-[12rem]" />
			<Button type="button" variant="outline" size="sm" onclick={addPollDraft}>
				<PlusIcon class="size-4" />
				Lägg till omröstning
			</Button>
			<Button type="submit" class="ml-auto" loading={isLoading} disabled={!canSubmit}>
				{#if isEditMode}
					<SaveIcon class="size-4" />
					Spara ändringar
				{:else}
					<PlusIcon class="size-4" />
					Lägg till punkt
				{/if}
			</Button>
		</div>

		{#if polls.length > 0}
			<div class="space-y-3">
				{#each polls as pollDraft, i (i)}
					<div class="relative flex gap-2">
						<div class="flex shrink-0 flex-col gap-0.5 text-muted-foreground">
							<Button type="button" variant="ghost" size="icon" onclick={() => movePollUp(i)}>
								<ChevronUpIcon class="size-4" />
							</Button>
							<Button type="button" variant="ghost" size="icon" onclick={() => movePollDown(i)}>
								<ChevronDownIcon class="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="hover:bg-destructive/10 hover:text-destructive"
								onclick={() =>
									confirm({
										title: 'Ta bort omröstning?',
										description: 'Är du säker på att du vill ta bort denna omröstning?',
										onConfirm: async () => {
											removePollDraft(i);
										},
									})}
								aria-label="Ta bort omröstning"
							>
								<Trash2Icon class="size-4" />
							</Button>
						</div>
						<div class="min-w-0 flex-1">
							<EditPoll
								bind:pollTitle={polls[i].title}
								bind:pollOptions={polls[i].options}
								bind:resultsPublic={polls[i].resultsPublic}
								bind:pollMaxVotesPerVoter={polls[i].maxVotesPerVoter}
							/>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</form>
{/if}
