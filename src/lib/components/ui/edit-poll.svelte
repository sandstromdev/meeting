<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import * as Field from '$lib/components/ui/field';
	import {
		Control as FormControl,
		Description as FormDescription,
		Field as FormField,
		FieldErrors as FormFieldErrors,
		Label as FormLabel,
	} from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import { NativeSelectOption } from '$lib/components/ui/native-select';
	import NativeSelect from '$lib/components/ui/native-select/native-select.svelte';
	import * as NumberField from '$lib/components/ui/number-field';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		ABSTAIN_OPTION_LABEL,
		MAJORITY_LABELS,
		type PollTableNames,
		type EditablePollDraft,
	} from '$lib/polls';
	import {
		PollDraftSchema,
		RefinePollDraftSchema,
		type PollDraft,
		type UserPollVisibility,
	} from '$lib/validation';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { tick } from 'svelte';
	import { get } from 'svelte/store';
	import { defaults, superForm } from 'sveltekit-superforms';
	import { zod4 } from 'sveltekit-superforms/adapters';

	type Props = {
		poll?: EditablePollDraft | null;
		isStandalone?: boolean;
		onSubmit: (draft: EditablePollDraft) => Promise<void>;
		submitLabel?: string;
		submitPendingLabel?: string;
		titlePlaceholder?: string;
		/** When true, shows a secondary button that calls `onDiscard`. */
		showDiscard?: boolean;
		onDiscard?: () => void;
		discardLabel?: string;
	};

	let {
		poll = {
			title: '',
			options: ['', ''],
			type: 'single_winner',
			winningCount: 1,
			majorityRule: 'simple',
			isResultPublic: false,
			allowsAbstain: true,
			maxVotesPerVoter: 1,
			visibilityMode: 'public',
		},
		isStandalone = false,
		onSubmit,
		submitLabel = 'Skapa omröstning',
		submitPendingLabel = 'Skapar...',
		titlePlaceholder = 'Omröstningens rubrik',
		showDiscard = false,
		onDiscard,
		discardLabel = 'Avbryt',
	}: Props = $props();

	const instanceId = $props.id();

	// svelte-ignore state_referenced_locally
	const pollForm = superForm(defaults(poll, zod4(PollDraftSchema)), {
		id: instanceId,
		SPA: true,
		validators: zod4(RefinePollDraftSchema),
		resetForm: false,
		onSubmit: () => submit(),
	});

	const { form: draft, validateForm, enhance } = pollForm;

	const optionsCount = $derived($draft.options.length);
	const canDeleteOption = $derived(
		$draft.allowsAbstain ? $draft.options.length > 1 : $draft.options.length > 2,
	);

	let submitting = $state(false);

	$effect(() => {
		const f = $draft;
		if (f.options.length === 0) {
			return;
		}
		const maxA = Math.max(1, f.options.length);
		let patch: Partial<PollDraft> | null = null;
		if (f.type === 'single_winner') {
			if (f.maxVotesPerVoter !== 1 || f.winningCount !== 1) {
				patch = { maxVotesPerVoter: 1, winningCount: 1 };
			}
		} else {
			const mv = Math.min(Math.max(1, Math.floor(f.maxVotesPerVoter)), maxA);
			const wc = Math.min(Math.max(1, Math.floor(f.winningCount ?? 1)), f.options.length);
			if (mv !== f.maxVotesPerVoter || wc !== (f.winningCount ?? 1)) {
				patch = { maxVotesPerVoter: mv, winningCount: wc };
			}
		}
		if (patch) {
			draft.update((d) => ({ ...d, ...patch }), { taint: false });
		}
	});

	function addPollOption() {
		draft.update((d) => ({ ...d, options: [...d.options, ''] }), { taint: true });
	}

	async function handlePollOptionKeydown(e: KeyboardEvent, i: number) {
		const len = get(draft).options.length;

		if (e.key === 'Enter' && i < len) {
			e.preventDefault();
			if (i === len - 1) {
				addPollOption();
				await tick();
			}
			document.getElementById(`option-${i + 1}`)?.focus();
		}

		if (e.key === 'Tab') {
			let idx = e.shiftKey ? i - 1 : i + 1;

			if (idx < 0) {
				return;
			}

			e.preventDefault();

			let optionsLen = get(draft).options.length;
			if (idx >= optionsLen) {
				addPollOption();
				await tick();
				optionsLen = get(draft).options.length;
				idx = optionsLen - 1;
			}

			document.getElementById(`option-${idx}`)?.focus();
		}
	}

	function removePollOption(index: number) {
		if (!canDeleteOption) {
			return;
		}

		draft.update((d) => ({ ...d, options: d.options.filter((_, i) => i !== index) }), {
			taint: true,
		});
	}

	function removeAllowsAbstain() {
		if (!$draft.allowsAbstain) {
			return;
		}

		draft.update(
			(d) => ({
				...d,
				allowsAbstain: false,
				options: d.options.length === 1 ? [...d.options, ''] : d.options,
			}),
			{ taint: true },
		);
	}

	async function submit() {
		if (!onSubmit) {
			return;
		}
		try {
			submitting = true;

			const result = await validateForm();

			if (!result.valid) {
				return;
			}

			await onSubmit(result.data);
		} finally {
			submitting = false;
		}
	}

	const resultsPublicOptions = $derived([
		{
			value: 'public',
			label: 'Alla kan se resultatet',
			description: 'Alla kan se resultatet av omröstningen.',
		},
		{
			value: 'private',
			label: `Endast ${isStandalone ? 'du' : 'admin'} kan se resultatet`,
			description: `Endast ${isStandalone ? 'du' : 'admin'} kan se resultatet av omröstningen.`,
		},
	]);
</script>

<form method="post" use:enhance class="contents text-foreground">
	<Field.Group>
		<FormField form={pollForm} name="title">
			<FormControl>
				{#snippet children({ props })}
					<FormLabel>Rubrik</FormLabel>
					<Input
						{...props}
						bind:value={$draft.title}
						placeholder={titlePlaceholder}
						class="w-full"
						autocomplete="off"
					/>
				{/snippet}
			</FormControl>
			<FormFieldErrors />
		</FormField>

		<Field.Set>
			<Field.Legend>Alternativ (minst 2)</Field.Legend>
			<Field.Description>Alternativen som röstaren kan välja mellan.</Field.Description>

			<FormField form={pollForm} name="allowsAbstain">
				<Field.Label for="allowsAbstain">
					<Field.Field orientation="horizontal">
						<Checkbox bind:checked={$draft.allowsAbstain} id="allowsAbstain" />
						<Field.Content>
							<Field.Title>Inkludera avstår</Field.Title>
							<Field.Description>
								När personer avstår minskar antalet röster som krävs för att vinna.
							</Field.Description>
						</Field.Content>
					</Field.Field>
				</Field.Label>
				<FormFieldErrors />
			</FormField>

			<div>
				<ul class="space-y-2">
					{#each $draft.options as _, i (i)}
						<li class="flex gap-2">
							<FormField form={pollForm} name="options[{i}]" class="w-full gap-2">
								<FormControl id={`option-${i}`}>
									{#snippet children({ props })}
										<InputGroup.Root>
											<InputGroup.Input
												{...props}
												bind:value={$draft.options[i]}
												placeholder="Alternativ {i + 1}"
												onkeydown={(e) => void handlePollOptionKeydown(e, i)}
											/>
											<InputGroup.Addon align="inline-start">
												{i + 1}.
											</InputGroup.Addon>
										</InputGroup.Root>
									{/snippet}
								</FormControl>
								<FormFieldErrors />
							</FormField>
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
					{#if $draft.allowsAbstain}
						<li class="flex gap-2">
							<InputGroup.Root>
								<InputGroup.Input
									value={ABSTAIN_OPTION_LABEL}
									disabled
									placeholder="Alternativ {$draft.options.length + 1}"
								/>
								<InputGroup.Addon align="inline-start">
									{$draft.options.length + 1}.
								</InputGroup.Addon>
							</InputGroup.Root>
							<Button
								type="button"
								variant="outline"
								size="icon"
								class="shrink-0 text-muted-foreground"
								onclick={removeAllowsAbstain}
								aria-label="Ta bort alternativ"
							>
								<Trash2Icon class="size-4" />
							</Button>
						</li>
					{/if}
				</ul>
				<Button type="button" variant="outline" size="sm" onclick={addPollOption} class="mt-2">
					<PlusIcon class="size-4" />
					Lägg till alternativ
				</Button>
			</div>

			<FormField form={pollForm} name="options" class="contents">
				<FormFieldErrors />
			</FormField>
		</Field.Set>

		<Field.Separator />

		<Tabs.Root bind:value={$draft.type}>
			<Tabs.List>
				<Tabs.Trigger value="multi_winner">Top X vinnare</Tabs.Trigger>
				<Tabs.Trigger value="single_winner">En vinnare (majoritet)</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="multi_winner" class="rounded-md border p-3">
				<Field.Group class="flex flex-row flex-wrap gap-x-4 gap-y-2">
					<FormField form={pollForm} name="winningCount" class="w-max">
						<FormControl>
							{#snippet children({ props })}
								<FormLabel>Antal vinnare</FormLabel>
								<NumberField.Root min={1} max={optionsCount} bind:value={$draft.winningCount}>
									<NumberField.Group class="max-w-40">
										<NumberField.Decrement />
										<NumberField.Input {...props} />
										<NumberField.Increment />
									</NumberField.Group>
								</NumberField.Root>
							{/snippet}
						</FormControl>
						<FormFieldErrors />
					</FormField>

					<FormField form={pollForm} name="maxVotesPerVoter" class="w-max">
						<FormControl>
							{#snippet children({ props })}
								<FormLabel>Max röster per person</FormLabel>
								<NumberField.Root min={1} max={optionsCount} bind:value={$draft.maxVotesPerVoter}>
									<NumberField.Group class="max-w-40">
										<NumberField.Decrement />
										<NumberField.Input {...props} />
										<NumberField.Increment />
									</NumberField.Group>
								</NumberField.Root>
							{/snippet}
						</FormControl>
						<FormFieldErrors />
					</FormField>
				</Field.Group>
			</Tabs.Content>

			<Tabs.Content value="single_winner" class="rounded-md border p-3">
				<FormField form={pollForm} name="majorityRule">
					<FormControl>
						{#snippet children({ props })}
							<FormLabel>Majoritetsregel</FormLabel>
							<FormDescription>En röst per person.</FormDescription>
							<div class="w-max">
								<NativeSelect {...props} bind:value={$draft.majorityRule}>
									{#each Object.entries(MAJORITY_LABELS) as [value, label] (value)}
										<NativeSelectOption {value}>{label}</NativeSelectOption>
									{/each}
								</NativeSelect>
							</div>
						{/snippet}
					</FormControl>
					<FormFieldErrors />
				</FormField>
			</Tabs.Content>
		</Tabs.Root>

		<Field.Separator />

		{#if isStandalone}
			<Field.Set>
				<Field.Legend>Säkerhet</Field.Legend>
				<Field.Description>Vem kan komma åt omröstningen?</Field.Description>
				<FormField form={pollForm} name="visibilityMode">
					<RadioGroup.Root bind:value={$draft.visibilityMode} class="grid auto-fit-60 gap-2">
						<Field.Label for="account_required">
							<Field.Field orientation="horizontal">
								<RadioGroup.Item value="account_required" id="account_required" />
								<Field.Content>
									<Field.Title>Konto krävs</Field.Title>
									<Field.Description>
										Endast inloggade användare kan rösta på denna omröstning.
									</Field.Description>
								</Field.Content>
							</Field.Field>
						</Field.Label>
						<Field.Label for="public">
							<Field.Field orientation="horizontal">
								<RadioGroup.Item value="public" id="public" />
								<Field.Content>
									<Field.Title>Offentlig</Field.Title>
									<Field.Description>Alla med koden kan delta i omröstningen.</Field.Description>
								</Field.Content>
							</Field.Field>
						</Field.Label>
					</RadioGroup.Root>
				</FormField>
			</Field.Set>

			<Field.Separator />
		{/if}

		<Field.Set>
			<Field.Legend>Synlighet</Field.Legend>
			<Field.Description>Vem kan se resultatet av omröstningen?</Field.Description>
			<FormField form={pollForm} name="isResultPublic">
				<RadioGroup.Root
					class="grid auto-fit-60 gap-2"
					value={$draft.isResultPublic ? 'public' : 'private'}
					onValueChange={(value) => ($draft.isResultPublic = value === 'public')}
				>
					{#each resultsPublicOptions as option (option.value)}
						<FormControl>
							{#snippet children({ props })}
								<Field.Label for={props.id}>
									<Field.Field orientation="horizontal">
										<RadioGroup.Item {...props} value={option.value} />
										<Field.Content>
											<Field.Title>{option.label}</Field.Title>
											<Field.Description>
												{option.description}
											</Field.Description>
										</Field.Content>
									</Field.Field>
								</Field.Label>
							{/snippet}
						</FormControl>
					{/each}
				</RadioGroup.Root>
				<FormFieldErrors />
			</FormField>
		</Field.Set>
	</Field.Group>

	<div class="mt-4 flex flex-wrap gap-2">
		{#if showDiscard}
			<Button type="button" variant="outline" onclick={() => onDiscard?.()}>
				{discardLabel}
			</Button>
		{/if}
		<Button type="submit" loading={submitting} disabled={submitting}>
			{submitting ? submitPendingLabel : submitLabel}
		</Button>
	</div>
</form>
