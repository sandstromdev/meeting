<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as CheckboxBlock from '$lib/components/ui/checkbox-block';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import Label from '$lib/components/ui/label/label.svelte';
	import { NativeSelectOption } from '$lib/components/ui/native-select';
	import NativeSelect from '$lib/components/ui/native-select/native-select.svelte';
	import * as NumberField from '$lib/components/ui/number-field';
	import * as Tabs from '$lib/components/ui/tabs';
	import { ABSTAIN_OPTION_LABEL, MAJORITY_LABELS } from '$lib/polls';
	import { cn } from '$lib/utils';
	import { RefinePollDraftSchema, type PollDraft } from '$lib/validation';
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

	const optionsCount = $derived(poll.options.length);
	const maxAllowed = $derived(Math.max(1, optionsCount));
	const canDeleteOption = $derived(
		poll.allowsAbstain ? poll.options.length > 1 : poll.options.length > 2,
	);

	let fieldErrors = $state<z.core.$ZodErrorTree<PollDraft, string>>({ errors: [] });

	let errors = $state<string>('');

	const validate = useDebounce((poll: PollDraft) => {
		const result = RefinePollDraftSchema.safeParse(poll);
		if (result.success) {
			errors = '';
			fieldErrors = { errors: [] };
		} else {
			errors = z.prettifyError(result.error);
			fieldErrors = z.treeifyError(result.error);
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

<div class={cn('rounded-md border bg-white p-3 text-primary', errors && 'border-destructive/50')}>
	<Field.Set>
		<Field.Legend>Redigera omröstning</Field.Legend>

		<Field.Field>
			<Field.Label for="title">Omröstningens rubrik</Field.Label>
			<Input
				id="title"
				bind:value={poll.title}
				placeholder="Omröstningens rubrik"
				class="w-full"
				aria-invalid={!!fieldErrors.properties?.title?.errors}
			/>
			<Field.Error errors={fieldErrors.properties?.title?.errors} />
		</Field.Field>

		<Tabs.Root bind:value={poll.type}>
			<Tabs.List>
				<Tabs.Trigger value="multi_winner">Top X vinnare</Tabs.Trigger>
				<Tabs.Trigger value="single_winner">En vinnare (majoritet)</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="multi_winner" class=" rounded-md border p-3">
				<Field.Group class="grid gap-2 md:grid-cols-2">
					<Field.Field>
						<Field.Label for="winning-count">Antal vinnare</Field.Label>
						<NumberField.Root min={1} max={optionsCount} bind:value={poll.winningCount}>
							<NumberField.Group class="max-w-40">
								<NumberField.Decrement />
								<NumberField.Input
									id="winning-count"
									aria-invalid={!!fieldErrors.properties?.winningCount?.errors}
								/>
								<NumberField.Increment />
							</NumberField.Group>
						</NumberField.Root>
						<Field.Error errors={fieldErrors.properties?.winningCount?.errors} />
					</Field.Field>

					<Field.Field>
						<Field.Label for="max-votes-per-voter">Max röster per deltagare</Field.Label>
						<NumberField.Root min={1} max={optionsCount} bind:value={poll.maxVotesPerVoter}>
							<NumberField.Group class="max-w-40">
								<NumberField.Decrement />
								<NumberField.Input
									id="max-votes-per-voter"
									aria-invalid={!!fieldErrors.properties?.maxVotesPerVoter?.errors}
								/>
								<NumberField.Increment />
							</NumberField.Group>
						</NumberField.Root>
						<Field.Error errors={fieldErrors.properties?.maxVotesPerVoter?.errors} />
					</Field.Field>
				</Field.Group>
			</Tabs.Content>

			<Tabs.Content value="single_winner" class="rounded-md border p-3">
				<Field.Field>
					<Field.Label for="majority-rule">Majoritetsregel</Field.Label>
					<Field.Description>En röst per deltagare.</Field.Description>
					<div class="w-max">
						<NativeSelect
							id="majority-rule"
							bind:value={poll.majorityRule}
							aria-invalid={!!fieldErrors.properties?.majorityRule?.errors}
						>
							{#each Object.entries(MAJORITY_LABELS) as [value, label] (value)}
								<NativeSelectOption {value}>{label}</NativeSelectOption>
							{/each}
						</NativeSelect>
					</div>
					<Field.Error errors={fieldErrors.properties?.majorityRule?.errors} />
				</Field.Field>
			</Tabs.Content>
		</Tabs.Root>

		<Field.Group class="gap-2">
			<CheckboxBlock.Root>
				<CheckboxBlock.Checkbox
					bind:checked={poll.isResultPublic}
					aria-invalid={!!fieldErrors.properties?.isResultPublic?.errors}
				/>
				<CheckboxBlock.Content>
					<CheckboxBlock.Title>Visa resultat</CheckboxBlock.Title>
					<CheckboxBlock.Description>
						Visa hur många röster varje alternativ fick för alla, annars endast admin.
					</CheckboxBlock.Description>
				</CheckboxBlock.Content>
			</CheckboxBlock.Root>

			<CheckboxBlock.Root>
				<CheckboxBlock.Checkbox
					bind:checked={poll.allowsAbstain}
					aria-invalid={!!fieldErrors.properties?.allowsAbstain?.errors}
				/>
				<CheckboxBlock.Content>
					<CheckboxBlock.Title>Inkludera avstår</CheckboxBlock.Title>
					<CheckboxBlock.Description>
						När deltagare avstår minskar antalet röster som krävs för att vinna.
					</CheckboxBlock.Description>
				</CheckboxBlock.Content>
			</CheckboxBlock.Root>
		</Field.Group>

		<Field.Set>
			<Field.Legend>Alternativ (minst 2)</Field.Legend>

			<ul class="space-y-2">
				{#each poll.options as _, i (i)}
					<li class="flex gap-2">
						<div
							class="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground"
						>
							{i + 1}
						</div>
						<div class="w-full space-y-2">
							<Input
								value={poll.options[i]}
								oninput={(e) => {
									poll.options = poll.options.with(i, (e.target as HTMLInputElement).value);
								}}
								placeholder="Alternativ {i + 1}"
								class="flex-1"
								aria-invalid={!!fieldErrors.properties?.options?.items?.[i]?.errors}
							/>
							<Field.Error errors={fieldErrors.properties?.options?.items?.[i]?.errors} />
						</div>
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
					</li>
				{/each}

				{#if poll.allowsAbstain}
					<li class="flex gap-2">
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
					</li>
				{/if}

				<li>
					<Button type="button" variant="outline" size="sm" onclick={addPollOption}>
						<PlusIcon class="size-4" />
						Lägg till alternativ
					</Button>
				</li>
			</ul>

			<Field.Error errors={fieldErrors.properties?.options?.errors} />
		</Field.Set>
	</Field.Set>
</div>
