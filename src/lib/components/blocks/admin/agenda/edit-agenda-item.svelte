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
	import type { PollDraft, MajorityRule, PollType } from './types';
	import { PollDraftSchema } from '$lib/validation';
	import XIcon from '@lucide/svelte/icons/x';

	const VACANT_OPTION_LABEL = 'Avstår';

	const meeting = getMeetingContext();

	let {
		agendaItemId,
		onClose = () => {},
	}: {
		agendaItemId?: string;
		onClose?: () => unknown;
	} = $props();

	const agenda = $derived(meeting.meeting.agenda ?? []);

	function findItemInAgenda(items: typeof agenda, id: string): (typeof agenda)[number] | null {
		for (const a of items) {
			if (a.id === id) {
				return a;
			}
			if (a.items?.length) {
				const found = findItemInAgenda(a.items, id);
				if (found) {
					return found;
				}
			}
		}
		return null;
	}

	const item = $derived(agendaItemId ? findItemInAgenda(agenda, agendaItemId) : null);
	const isEditMode = $derived(!!agendaItemId);

	function newPollDraft() {
		return {
			title: '',
			options: ['', ''],
			type: 'single_winner' as PollType,
			winningCount: 1,
			majorityRule: 'simple' as MajorityRule,
			resultsPublic: false,
			includeVacantOption: true,
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
			polls = item.polls.map((p) => {
				const opts = [...p.options];
				const includeVacant = p.allowsAbstain;
				const options =
					includeVacant && opts[opts.length - 1] === VACANT_OPTION_LABEL ? opts.slice(0, -1) : opts;
				return {
					id: p.id,
					title: p.title,
					options,
					type: (p.type ?? 'single_winner') as PollType,
					winningCount: p.winningCount ?? 1,
					majorityRule: (p.majorityRule ?? 'simple') as MajorityRule,
					resultsPublic: p.resultsPublic,
					includeVacantOption: includeVacant,
					maxVotesPerVoter: p.maxVotesPerVoter ?? 1,
				};
			});
			initialPollIds = item.polls.map((p) => p.id as Id<'polls'>);
			originalPolls.clear();

			for (const p of item.polls) {
				const opts = [...p.options];
				const includeVacant = p.allowsAbstain;
				const options =
					includeVacant && opts[opts.length - 1] === VACANT_OPTION_LABEL ? opts.slice(0, -1) : opts;
				originalPolls.set(p.id, {
					title: p.title,
					options,
					type: (p.type ?? 'single_winner') as PollType,
					winningCount: p.winningCount ?? 1,
					majorityRule: (p.majorityRule ?? 'simple') as MajorityRule,
					resultsPublic: p.resultsPublic,
					includeVacantOption: includeVacant,
					maxVotesPerVoter: p.maxVotesPerVoter ?? 1,
				});
			}
		}

		if (!isEditMode) {
			lastSyncedId = null;
		}
	});

	const canSubmit = $derived(!!newTitle.trim() && polls.length !== 0);

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
			orig.type !== draft.type ||
			orig.winningCount !== draft.winningCount ||
			orig.majorityRule !== draft.majorityRule ||
			orig.resultsPublic !== draft.resultsPublic ||
			orig.includeVacantOption !== draft.includeVacantOption ||
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
				(options.length >= 2 || (options.length >= 1 && poll.includeVacantOption))
			) {
				await meeting.adminMutate(api.admin.poll.createPoll, {
					agendaItemId: created.id,
					title: poll.title.trim(),
					options,
					type: poll.type,
					winningCount: poll.type === 'multi_winner' ? poll.winningCount : undefined,
					majorityRule: poll.type === 'single_winner' ? poll.majorityRule : undefined,
					allowsAbstain: poll.includeVacantOption,
					resultsPublic: poll.resultsPublic,
					maxVotesPerVoter:
						poll.type === 'multi_winner'
							? Math.min(poll.maxVotesPerVoter, options.length + (poll.includeVacantOption ? 1 : 0))
							: undefined,
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
					(options.length >= 2 || (options.length >= 1 && draft.includeVacantOption))
				) {
					const pollId = await meeting.adminMutate(api.admin.poll.createPoll, {
						agendaItemId,
						title: draft.title.trim(),
						options,
						type: draft.type,
						winningCount: draft.type === 'multi_winner' ? draft.winningCount : undefined,
						majorityRule: draft.type === 'single_winner' ? draft.majorityRule : undefined,
						allowsAbstain: draft.includeVacantOption,
						resultsPublic: draft.resultsPublic,
						maxVotesPerVoter:
							draft.type === 'multi_winner'
								? Math.min(
										draft.maxVotesPerVoter,
										options.length + (draft.includeVacantOption ? 1 : 0),
									)
								: undefined,
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
				if (options.length >= 2 || (options.length >= 1 && draft.includeVacantOption)) {
					await meeting.adminMutate(api.admin.poll.editPoll, {
						pollId: draft.id,
						title: draft.title.trim(),
						options,
						type: draft.type,
						winningCount: draft.type === 'multi_winner' ? draft.winningCount : undefined,
						majorityRule: draft.type === 'single_winner' ? draft.majorityRule : undefined,
						allowsAbstain: draft.includeVacantOption,
						resultsPublic: draft.resultsPublic,
						maxVotesPerVoter:
							draft.type === 'multi_winner'
								? Math.min(
										draft.maxVotesPerVoter,
										options.length + (draft.includeVacantOption ? 1 : 0),
									)
								: undefined,
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
							<EditPoll bind:poll={polls[i]} />
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if isEditMode && item}
			<EditSubItems parentItem={item} />
		{/if}
	</form>
{/if}
