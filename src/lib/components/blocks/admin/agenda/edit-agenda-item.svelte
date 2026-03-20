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
	import EditSubItems from './edit-sub-items.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { ABSTAIN_OPTION_LABEL, type MajorityRule, type PollType } from '$lib/polls';
	import { PollDraftSchema, type PollDraft } from '$lib/validation';
	import XIcon from '@lucide/svelte/icons/x';

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

	function newPollDraft() {
		return {
			title: '',
			options: ['', ''],
			type: 'single_winner' as PollType,
			winningCount: 1,
			majorityRule: 'simple' as MajorityRule,
			isResultPublic: false,
			allowsAbstain: true,
			maxVotesPerVoter: 1,
		} satisfies PollDraft;
	}

	type EditablePollDraft = PollDraft & { id?: Id<'polls'> };

	function hydrateToDraft(
		p: NonNullable<typeof currentPollsResult.data>[number],
	): EditablePollDraft {
		const opts = [...p.options];
		const options =
			p.allowsAbstain && opts[opts.length - 1] === ABSTAIN_OPTION_LABEL ? opts.slice(0, -1) : opts;

		return {
			id: p._id,
			title: p.title,
			options,
			type: p.type,
			winningCount: p.type === 'multi_winner' ? p.winningCount : 1,
			majorityRule: p.type === 'single_winner' ? p.majorityRule : 'simple',
			isResultPublic: p.isResultPublic,
			allowsAbstain: p.allowsAbstain,
			maxVotesPerVoter: p.maxVotesPerVoter,
		};
	}

	const currentPollsResult = meeting.adminQuery(api.admin.poll.getPollsByAgendaItemId, () =>
		isEditMode && agendaItemId ? { agendaItemId } : 'skip',
	);

	let newTitle = $state('');
	let polls = $state<EditablePollDraft[]>([]);
	let isLoading = $state(false);
	let lastSyncedId = $state<string | null>(null);
	let initialPollIds = $state<Id<'polls'>[]>([]);
	let originalPolls = new SvelteMap<Id<'polls'>, EditablePollDraft>();

	$effect(() => {
		if (isEditMode && item && item.id !== lastSyncedId) {
			const currentPolls = currentPollsResult.data;
			if (!currentPolls) {
				return;
			}
			lastSyncedId = item.id;
			newTitle = item.title;
			polls = currentPolls.map(hydrateToDraft);
			initialPollIds = currentPolls.map((p) => p._id as Id<'polls'>);
			originalPolls.clear();
			for (const p of currentPolls) {
				originalPolls.set(p._id, hydrateToDraft(p));
			}
		}

		if (!isEditMode) {
			lastSyncedId = null;
		}
	});

	const canSubmit = $derived(!!newTitle.trim());

	function addPollDraft() {
		polls = [...polls, newPollDraft()];
	}

	function addYesOrNoPollDraft() {
		polls = [
			...polls,
			{
				...newPollDraft(),
				options: ['Ja', 'Nej'],
				type: 'single_winner',
				majorityRule: 'simple',
				allowsAbstain: true,
			},
		];
	}

	function addMultiWinnerPollDraft() {
		polls = [
			...polls,
			{
				...newPollDraft(),
				type: 'multi_winner',
				winningCount: 1,
				majorityRule: 'simple',
				allowsAbstain: true,
				options: Array.from({ length: 10 }, (_, i) => ``),
			},
		];
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

	function draftChanged(draft: EditablePollDraft): boolean {
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
			orig.type !== draft.type ||
			orig.winningCount !== draft.winningCount ||
			orig.majorityRule !== draft.majorityRule ||
			orig.isResultPublic !== draft.isResultPublic ||
			orig.allowsAbstain !== draft.allowsAbstain ||
			orig.maxVotesPerVoter !== draft.maxVotesPerVoter
		);
	}

	async function submitCreate() {
		const created = await meeting.adminMutate(api.admin.agenda.createAgendaItem, {
			title: newTitle.trim(),
		});

		for (const poll of polls) {
			const options = poll.options.map((o) => o.trim()).filter(Boolean);
			if (
				poll.title.trim() &&
				(options.length >= 2 || (options.length >= 1 && poll.allowsAbstain))
			) {
				await meeting.adminMutate(api.admin.poll.createPoll, {
					agendaItemId: created.id,
					draft: {
						title: poll.title.trim(),
						options,
						type: poll.type,
						winningCount: poll.type === 'multi_winner' ? poll.winningCount : 1,
						majorityRule: poll.type === 'single_winner' ? poll.majorityRule : undefined,
						allowsAbstain: poll.allowsAbstain,
						isResultPublic: poll.isResultPublic,
						maxVotesPerVoter:
							poll.type === 'multi_winner' ? Math.min(poll.maxVotesPerVoter, options.length) : 1,
					},
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
				if (
					draft.title.trim() &&
					(options.length >= 2 || (options.length >= 1 && draft.allowsAbstain))
				) {
					const pollId = await meeting.adminMutate(api.admin.poll.createPoll, {
						agendaItemId,
						draft: {
							title: draft.title.trim(),
							options,
							type: draft.type,
							winningCount: draft.type === 'multi_winner' ? draft.winningCount : 1,
							majorityRule: draft.type === 'single_winner' ? draft.majorityRule : undefined,
							allowsAbstain: draft.allowsAbstain,
							isResultPublic: draft.isResultPublic,
							maxVotesPerVoter:
								draft.type === 'multi_winner'
									? Math.min(draft.maxVotesPerVoter, options.length)
									: 1,
						},
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
				if (options.length >= 2 || (options.length >= 1 && draft.allowsAbstain)) {
					await meeting.adminMutate(api.admin.poll.editPoll, {
						pollId: draft.id,
						edits: {
							title: draft.title.trim(),
							options,
							type: draft.type,
							winningCount: draft.type === 'multi_winner' ? draft.winningCount : 1,
							majorityRule: draft.type === 'single_winner' ? draft.majorityRule : undefined,
							allowsAbstain: draft.allowsAbstain,
							isResultPublic: draft.isResultPublic,
							maxVotesPerVoter:
								draft.type === 'multi_winner'
									? Math.min(draft.maxVotesPerVoter, options.length)
									: 1,
						},
					});
				}
			}
		}
	}

	async function onsubmit(e: Event) {
		e.preventDefault();

		for (const poll of polls) {
			const result = PollDraftSchema.safeParse(poll);
			if (!result.success) {
				return;
			}
		}

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
			<Button type="button" variant="outline" size="sm" onclick={addYesOrNoPollDraft}>
				<PlusIcon class="size-4" />
				Lägg till ja/nej omröstning
			</Button>
			<Button type="button" variant="outline" size="sm" onclick={addMultiWinnerPollDraft}>
				<PlusIcon class="size-4" />
				Lägg till fleromröstning
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
			{#if isEditMode}
				<Button type="button" variant="outline" size="icon" onclick={() => onClose?.()}>
					<XIcon class="size-4" />
				</Button>
			{/if}
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
							{#if polls[i]}
								<EditPoll bind:poll={polls[i]} />
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if isEditMode && item}
			<EditSubItems parentItemId={item.id} parentDepth={item.depth} />
		{/if}
	</form>
{/if}
