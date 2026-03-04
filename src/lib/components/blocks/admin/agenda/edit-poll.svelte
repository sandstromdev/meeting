<script lang="ts">
	import { ABSTAIN_OPTION_LABEL } from '$convex/helpers/poll';
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { Input } from '$lib/components/ui/input';
	import Label from '$lib/components/ui/label/label.svelte';
	import { NativeSelectOption } from '$lib/components/ui/native-select';
	import NativeSelect from '$lib/components/ui/native-select/native-select.svelte';
	import { cn } from '$lib/utils';
	import { PollDraftSchema } from '$lib/validation';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Debounced, useDebounce } from 'runed';
	import type { MajorityRule, PollDraft } from './types';
	import * as z from 'zod';
	import { untrack } from 'svelte';

	const MAJORITY_LABELS = {
		simple: 'Enkel majoritet (>50 %)',
		two_thirds: 'Kvalificerad majoritet (≥2/3)',
		three_quarters: '3/4 majoritet',
		unanimous: 'Enighet (100 %)',
	} satisfies Record<MajorityRule, string>;

	let {
		poll = $bindable({
			title: '',
			options: ['', ''],
			type: 'single_winner',
			winningCount: 1,
			majorityRule: 'simple',
			resultsPublic: false,
			includeVacantOption: true,
			maxVotesPerVoter: 1,
		}),
	}: { poll: PollDraft } = $props();

	const optionsCount = $derived(
		Math.max(2, poll.options.map((option) => option.trim()).filter(Boolean).length),
	);
	const maxAllowed = $derived(Math.max(1, optionsCount));
	const canDeleteOption = $derived(
		poll.includeVacantOption ? poll.options.length > 1 : poll.options.length > 2,
	);

	let errors = $state<string>('');

	const validate = useDebounce((poll: PollDraft) => {
		const result = PollDraftSchema.safeParse(poll);
		if (result.success) {
			errors = '';
		} else {
			errors = z.prettifyError(result.error);
		}
	}, 500);

	$effect(() => {
		const p = $state.snapshot(poll);
		untrack(() => validate(p));
	});

	$effect(() => {
		if (poll.type === 'single_winner') {
			poll.maxVotesPerVoter = 1;
			poll.winningCount = 1;
		} else {
			poll.maxVotesPerVoter = Math.min(Math.max(1, Math.floor(poll.maxVotesPerVoter)), maxAllowed);
			poll.winningCount = Math.min(Math.max(1, Math.floor(poll.winningCount)), optionsCount);
		}
	});

	function addPollOption() {
		poll.options = [...poll.options, ''];
	}

	function removePollOption(index: number) {
		if (!canDeleteOption) {
			return;
		}
		poll.options = poll.options.filter((_, i) => i !== index);
	}

	function removeVacantOption() {
		if (!poll.includeVacantOption) {
			return;
		}

		poll.includeVacantOption = false;

		if (poll.options.length === 1) {
			addPollOption();
		}
	}
</script>

<div
	class={cn(
		'space-y-2 rounded-md border bg-muted/30 p-3 ',
		errors && 'border-destructive/50 bg-destructive/5',
	)}
>
	<Input bind:value={poll.title} placeholder="Omröstningens rubrik" class="w-full" />

	<div class="space-y-2">
		<Label class="text-sm">Typ av omröstning</Label>
		<div class="flex flex-wrap gap-3">
			<label class="flex items-center gap-2 text-sm">
				<input type="radio" bind:group={poll.type} value="multi_winner" />
				Top X vinnare (flera val per deltagare)
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="radio" bind:group={poll.type} value="single_winner" />
				En vinnare (majoritet)
			</label>
		</div>
	</div>

	{#if poll.type === 'multi_winner'}
		<div class="grid w-max grid-cols-2 gap-4">
			<Label for="winning-count" class="text-sm">Antal vinnare (top X)</Label>
			<Input
				id="winning-count"
				inputmode="numeric"
				type="number"
				min={1}
				max={optionsCount}
				bind:value={poll.winningCount}
				class="w-24"
			/>

			<Label for="max-votes-per-voter" class="text-sm">Max röster per deltagare</Label>
			<Input
				id="max-votes-per-voter"
				inputmode="numeric"
				type="number"
				min={1}
				max={maxAllowed}
				bind:value={poll.maxVotesPerVoter}
				class="w-24"
			/>
		</div>
	{:else}
		<div class="flex items-center gap-2">
			<Label class="text-sm">Majoritetsregel</Label>
			<NativeSelect bind:value={poll.majorityRule}>
				{#each Object.entries(MAJORITY_LABELS) as [value, label] (value)}
					<NativeSelectOption {value}>{label}</NativeSelectOption>
				{/each}
			</NativeSelect>
		</div>
		<p class="text-xs text-muted-foreground">En röst per deltagare.</p>
	{/if}

	<Label class="flex items-center gap-2 text-sm">
		<Checkbox bind:checked={poll.resultsPublic} />
		Visa resultat för alla (annars endast admin)
	</Label>
	<Label class="flex items-center gap-2 text-sm">
		<Checkbox bind:checked={poll.includeVacantOption} />
		Inkludera ledig (avstår) som alternativ
	</Label>
	<p class="text-xs text-muted-foreground">Alternativ (minst 2)</p>
	<div class="space-y-2">
		{#each poll.options as _, i (i)}
			<div class="flex gap-2">
				<div
					class="grid size-9 place-items-center rounded-md border bg-background text-muted-foreground"
				>
					{i + 1}
				</div>
				<Input
					value={poll.options[i]}
					oninput={(e) => {
						poll.options = poll.options.with(i, (e.target as HTMLInputElement).value);
					}}
					placeholder="Alternativ {i + 1}"
					class="flex-1"
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="shrink-0 text-muted-foreground"
					disabled={!canDeleteOption}
					onclick={() => removePollOption(i)}
					aria-label="Ta bort alternativ"
				>
					<Trash2Icon class="size-4" />
				</Button>
			</div>
		{/each}
		{#if poll.includeVacantOption}
			<div class="flex gap-2">
				<div
					class="grid size-9 place-items-center rounded-md border bg-background text-muted-foreground"
				>
					{poll.options.length + 1}
				</div>
				<Input
					value={ABSTAIN_OPTION_LABEL}
					disabled
					placeholder="Alternativ {poll.options.length + 1}"
					class="flex-1"
				/>
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="shrink-0 text-muted-foreground"
					onclick={() => removeVacantOption()}
					aria-label="Ta bort alternativ"
				>
					<Trash2Icon class="size-4" />
				</Button>
			</div>
		{/if}
		<Button type="button" variant="outline" size="sm" onclick={addPollOption}>
			<PlusIcon class="size-4" />
			Lägg till alternativ
		</Button>

		{#if errors}
			<pre
				class="mt-4 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-destructive">{errors}</pre>
		{/if}
	</div>
</div>
