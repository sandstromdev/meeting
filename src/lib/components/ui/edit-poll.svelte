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
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import {
		ABSTAIN_OPTION_LABEL,
		MAJORITY_LABELS,
		newPollDraft,
		type EditablePollDraft,
		type UserPollDraft,
	} from '$lib/polls';
	import {
		normalizePollDraftVisibility,
		pollDraftObjectSchema,
		RefinePollDraftObjectSchema,
		RefineStandalonePollDraftObjectSchema,
		standalonePollDraftObjectSchema,
		type PollDraft,
		type PollDraftInput,
		type StandalonePollDraftFormValues,
	} from '$lib/validation';
	import { resolve } from '$app/paths';
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
		poll = newPollDraft(),
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
	const pollObjectSchema = isStandalone ? standalonePollDraftObjectSchema : pollDraftObjectSchema;
	// svelte-ignore state_referenced_locally
	const pollRefineSchema = isStandalone
		? RefineStandalonePollDraftObjectSchema
		: RefinePollDraftObjectSchema;

	// svelte-ignore state_referenced_locally
	const pollForm = superForm(defaults(poll, zod4(pollObjectSchema)), {
		id: instanceId,
		SPA: true,
		validators: zod4(pollRefineSchema),
		resetForm: false,
		dataType: 'json',
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
		let patch: Partial<PollDraftInput> | null = null;
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
		draft.update((d) => ({ ...d, options: [...d.options, { title: '', description: null }] }), {
			taint: true,
		});
	}

	async function handlePollOptionKeydown(e: KeyboardEvent, i: number) {
		const len = get(draft).options.length;

		if (e.key === 'Enter' && i < len) {
			e.preventDefault();
			if (i === len - 1) {
				addPollOption();
				await tick();
			}
			document.getElementById(`option-title-${i + 1}`)?.focus();
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

			document.getElementById(`option-title-${idx}`)?.focus();
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
				options:
					d.options.length === 1 ? [...d.options, { title: '', description: null }] : d.options,
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

			await onSubmit(normalizePollDraftVisibility(result.data));
		} finally {
			submitting = false;
		}
	}

	const resultsVisibilityOptions = $derived([
		{
			value: 'none' as const,
			label: `Endast ${isStandalone ? 'du' : 'admin'} ser resultatet`,
			description: `Ingen annan ser utfallet när omröstningen är stängd.`,
		},
		{
			value: 'winner' as const,
			label: 'Alla ser vem som vann',
			description:
				'Alla ser vilket alternativ som vann, men inte hur många röster varje alternativ fick.',
		},
		{
			value: 'full' as const,
			label: 'Alla ser hela resultatet',
			description: 'Alla ser röstfördelning och antal röster per alternativ.',
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

		{#if isStandalone}
			<FormField form={pollForm} name={'code' as any}>
				<FormControl>
					{#snippet children({ props })}
						<FormLabel>Kod (valfri)</FormLabel>
						<FormDescription>
							4–24 tecken. Endast bokstäver, siffror och bindestreck. Måste börja och sluta med en
							bokstav eller siffra. Lämna tomt för att generera en kod automatiskt.
						</FormDescription>
						<Input
							{...props}
							value={($draft as StandalonePollDraftFormValues).code}
							placeholder="t.ex. styrelseval-2026"
							class="w-full font-mono"
							autocomplete="off"
							spellcheck="false"
							oninput={(e) =>
								draft.update(
									(d) => ({
										...(d as StandalonePollDraftFormValues),
										code: e.currentTarget.value,
									}),
									{ taint: true },
								)}
						/>
						{#if ($draft as StandalonePollDraftFormValues).code.trim() !== ''}
							<p class="text-sm text-muted-foreground">
								Röstsida:
								<a
									class="font-mono underline"
									href={resolve(`/p/${($draft as StandalonePollDraftFormValues).code.trim()}`)}
								>
									{resolve(`/p/${($draft as StandalonePollDraftFormValues).code.trim()}`)}
								</a>
							</p>
						{/if}
					{/snippet}
				</FormControl>
				<FormFieldErrors />
			</FormField>
		{/if}

		<Field.Set>
			<Field.Legend>Alternativ (minst 2)</Field.Legend>

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
				<ul class="space-y-4">
					{#each $draft.options as _, i (i)}
						<li class="flex flex-col gap-2 sm:flex-row sm:items-start">
							<div class="min-w-0 flex-1 space-y-2">
								<!-- Dynamic index paths for superforms -->
								<FormField
									form={pollForm}
									name={`options.${i}.title` as never}
									class="w-full gap-2"
								>
									<FormControl id={`option-title-${i}`}>
										{#snippet children({ props })}
											<InputGroup.Root>
												<InputGroup.Input
													{...props}
													bind:value={$draft.options[i].title}
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
								<FormField
									form={pollForm}
									name={`options.${i}.description` as never}
									class="w-full gap-1"
								>
									<FormControl>
										{#snippet children({ props })}
											<Textarea
												{...props}
												value={$draft.options[i].description ?? ''}
												placeholder="Kort förklaring som visas vid röstning"
												rows={2}
												class="min-h-0 resize-y"
												oninput={(e) => {
													const raw = e.currentTarget.value;
													draft.update(
														(d) => {
															const next = [...d.options];
															next[i] = {
																...next[i],
																description: raw.trim() === '' ? null : raw,
															};
															return { ...d, options: next };
														},
														{ taint: true },
													);
												}}
											/>
										{/snippet}
									</FormControl>
									<FormFieldErrors />
								</FormField>
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
				<Tabs.Trigger value="single_winner">En vinnare</Tabs.Trigger>
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

			<Field.Set>
				<Field.Legend>Infosida (projektor)</Field.Legend>
				<Field.Description>
					Visa en sida med kod, QR och röstsiffror. Hur mycket av <strong>slutresultatet</strong> som
					visas styrs av synlighet nedan.
				</Field.Description>
				<Field.Field orientation="horizontal">
					<Switch
						id="infoPageEnabled"
						checked={Boolean(($draft as UserPollDraft).infoPageEnabled)}
						onCheckedChange={(v) =>
							draft.update((d) => ({ ...d, infoPageEnabled: v === true }) as UserPollDraft)}
					/>
					<Field.Content>
						<Field.Label for="infoPageEnabled" class="font-medium"
							>Aktivera '/info'-sidan</Field.Label
						>
						<Field.Description>
							Länken kan delas för projektor eller värdskap. Utan detta ger samma kod ett fel som
							vid ogiltig kod.
						</Field.Description>
					</Field.Content>
				</Field.Field>
				<Field.Field orientation="horizontal">
					<Switch
						id="infoPageShowLiveVoteCounts"
						checked={Boolean(($draft as UserPollDraft).infoPageShowLiveVoteCounts)}
						disabled={!($draft as UserPollDraft).infoPageEnabled}
						onCheckedChange={(v) =>
							draft.update(
								(d) => ({ ...d, infoPageShowLiveVoteCounts: v === true }) as UserPollDraft,
							)}
					/>
					<Field.Content>
						<Field.Label for="infoPageShowLiveVoteCounts" class="font-medium"
							>Visa antal röster medan omröstningen är öppen</Field.Label
						>
						<Field.Description>
							Visar aggregerat antal röster och antal röstande på infosidan. Gäller inte per
							alternativ.
						</Field.Description>
					</Field.Content>
				</Field.Field>
			</Field.Set>

			<Field.Separator />
		{/if}

		<Field.Set>
			<Field.Legend>Synlighet</Field.Legend>
			<FormField form={pollForm} name="resultVisibility">
				<RadioGroup.Root
					class="grid auto-fit-60 gap-2"
					value={$draft.resultVisibility}
					onValueChange={(value) => {
						$draft.resultVisibility = value as PollDraft['resultVisibility'];
						$draft.isResultPublic = value === 'full';
					}}
				>
					{#each resultsVisibilityOptions as option (option.value)}
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
