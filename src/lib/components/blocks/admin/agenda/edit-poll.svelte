<script lang="ts">
	import { ABSTAIN_OPTION_LABEL } from '$convex/helpers/poll';
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import { Input } from '$lib/components/ui/input';
	import Label from '$lib/components/ui/label/label.svelte';
	import { NativeSelectOption } from '$lib/components/ui/native-select';
	import NativeSelect from '$lib/components/ui/native-select/native-select.svelte';
	import { MAJORITY_LABELS } from '$lib/polls';
	import { cn } from '$lib/utils';
	import { PollDraftSchema, type PollDraft } from '$lib/validation';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { useDebounce } from 'runed';
	import { untrack } from 'svelte';
	import * as z from 'zod';

	let {
		poll = $bindable({
			title: '',
			options: ['', ''],
			type: 'single_winner',
			winningCount: 1,
			majorityRule: 'simple',
			isResultPublic: false,
			allowsAbstain: true,
			maxVotesPerVoter: 1,
		}),
	}: { poll: PollDraft } = $props();

	const optionsCount = $derived(
		Math.max(2, poll.options.map((option) => option.trim()).filter(Boolean).length),
	);
	const maxAllowed = $derived(Math.max(1, optionsCount));
	const canDeleteOption = $derived(
		poll.allowsAbstain ? poll.options.length > 1 : poll.options.length > 2,
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
			poll.winningCount = Math.min(Math.max(1, Math.floor(poll.winningCount ?? 1)), optionsCount);
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

	function removeAllowsAbstain() {
		if (!poll.allowsAbstain) {
			return;
		}

		poll.allowsAbstain = false;

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
		<Checkbox bind:checked={poll.isResultPublic} />
		Visa resultat för alla (annars endast admin)
	</Label>
	<Label class="flex items-center gap-2 text-sm">
		<Checkbox bind:checked={poll.allowsAbstain} />
		Inkludera avstår som alternativ
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
		{#if poll.allowsAbstain}
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
					onclick={() => removeAllowsAbstain()}
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
