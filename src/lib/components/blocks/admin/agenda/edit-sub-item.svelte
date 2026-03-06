<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { ABSTAIN_OPTION_LABEL } from '$convex/helpers/poll';
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
	import type { PollDraft, MajorityRule, PollType } from './types';
	import { PollDraftSchema } from '$lib/validation';

	const meeting = getMeetingContext();

	type SubItem = {
		id: string;
		title: string;
		polls: {
			id: Id<'polls'>;
			title: string;
			options: string[];
			type?: string;
			winningCount?: number;
			majorityRule?: string;
			allowsAbstain: boolean;
			maxVotesPerVoter?: number;
			resultsPublic?: boolean;
		}[];
	};

	let {
		subItem,
		onClose = () => {},
	}: {
		subItem: SubItem;
		onClose?: () => void;
	} = $props();

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

	function hydrateToDraft(p: SubItem['polls'][number]): PollDraft {
		const opts = [...p.options];
		const includeVacant = p.allowsAbstain;
		const options =
			includeVacant && opts[opts.length - 1] === ABSTAIN_OPTION_LABEL ? opts.slice(0, -1) : opts;
		return {
			id: p.id,
			title: p.title,
			options,
			type: (p.type ?? 'single_winner') as PollType,
			winningCount: p.winningCount ?? 1,
			majorityRule: (p.majorityRule ?? 'simple') as MajorityRule,
			resultsPublic: p.resultsPublic ?? false,
			includeVacantOption: includeVacant,
			maxVotesPerVoter: p.maxVotesPerVoter ?? 1,
		};
	}

	let newTitle = $state('');
	let polls = $state<PollDraft[]>([]);
	let isLoading = $state(false);
	let lastSyncedId = $state<string | null>(null);
	let initialPollIds = $state<Id<'polls'>[]>([]);
	let originalPolls = new SvelteMap<Id<'polls'>, PollDraft>();

	$effect(() => {
		const current = subItem;
		if (current.id !== lastSyncedId) {
			lastSyncedId = current.id;
			newTitle = current.title;
			polls = current.polls.map(hydrateToDraft);
			initialPollIds = current.polls.map((p) => p.id as Id<'polls'>);
			originalPolls.clear();
			for (const p of current.polls) {
				originalPolls.set(p.id, hydrateToDraft(p));
			}
		}
	});

	const canSubmit = $derived(!!newTitle.trim() && polls.length !== 0);

	function addPollDraft() {
		polls = [...polls, newPollDraft()];
	}

	function movePollUp(index: number) {
		if (index <= 0) return;
		polls = [
			...polls.slice(0, index - 1),
			polls[index],
			polls[index - 1],
			...polls.slice(index + 1),
		];
	}

	function movePollDown(index: number) {
		if (index >= polls.length - 1) return;
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
		if (!draft.id) return false;
		const orig = originalPolls.get(draft.id);
		if (!orig) return false;
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

	async function submitEdit() {
		const agendaItemId = subItem.id;

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

		onClose?.();
	}

	async function handleSubmit(e?: Event) {
		e?.preventDefault();
		for (const poll of polls) {
			const result = PollDraftSchema.safeParse(poll);
			if (!result.success) return;
		}
		if (!canSubmit) return;
		isLoading = true;
		await submitEdit();
		isLoading = false;
	}
</script>

<div class="space-y-4" role="form">
	<div class="flex flex-wrap items-center gap-2">
		<Input bind:value={newTitle} placeholder="Rubrik underpunkt" class="min-w-[12rem]" />
		<Button type="button" variant="outline" size="sm" onclick={addPollDraft}>
			<PlusIcon class="size-4" />
			Lägg till omröstning
		</Button>
		<Button
			type="button"
			class="ml-auto"
			loading={isLoading}
			disabled={!canSubmit}
			onclick={(e) => handleSubmit(e)}
		>
			<SaveIcon class="size-4" />
			Spara ändringar
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
									onConfirm: async () => removePollDraft(i),
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
</div>
