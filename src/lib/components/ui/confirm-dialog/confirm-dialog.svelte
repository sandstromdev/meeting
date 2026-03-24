<script lang="ts" module>
	import type { ButtonVariant } from '$lib/components/ui/button/index.js';

	const DEFAULT_CONFIRM_VALUE = 'confirm';

	export type ConfirmAction<Value = string> = {
		value: Value;
		text: string;
		variant?: ButtonVariant;
		onClick?: (value: Value) => void | Promise<unknown>;
	};

	export type ConfirmOptions<Value = string> = {
		title: string;
		description: string;
		skipConfirmation?: boolean;
		input?: {
			confirmationText: string;
		};
		confirm?: {
			text?: string;
			variant?: ButtonVariant;
		};
		cancel?: {
			text?: string;
			variant?: ButtonVariant;
		};
		actions?: ConfirmAction<Value>[];
		onConfirm?: (value: Value) => Promise<unknown> | unknown;
		onCancel?: () => void;
		/**
		 * When true, the cancel button stays enabled while an action is in progress.
		 * By default, cancel is disabled during loading so users cannot dismiss mid-mutation.
		 */
		allowCancelWhileLoading?: boolean;
	};

	function getActionList<Value>(opts: ConfirmOptions<Value>): ConfirmAction<Value>[] {
		if (opts.actions && opts.actions.length > 0) {
			return opts.actions;
		}
		return [
			{
				value: DEFAULT_CONFIRM_VALUE as Value,
				text: opts.confirm?.text ?? 'Bekräfta',
				variant: 'destructive',
			},
		];
	}

	function getPrimaryAction<Value>(opts: ConfirmOptions<Value>): ConfirmAction<Value> {
		const list = getActionList(opts);
		return list[list.length - 1];
	}

	async function runActionHandlers<Value>(
		opts: ConfirmOptions<Value>,
		action: ConfirmAction<Value>,
	): Promise<boolean> {
		const value = action.value;
		let ran = false;
		if (action.onClick) {
			await action.onClick(value);
			ran = true;
		}
		if (opts.onConfirm) {
			await Promise.resolve(opts.onConfirm(value));
			ran = true;
		}
		return ran;
	}

	class ConfirmDialogState {
		open = $state(false);
		inputText = $state('');
		options = $state<ConfirmOptions<unknown> | null>(null);
		resolvedActions = $state<ConfirmAction<unknown>[]>([]);
		/** Which action is currently running; only that button shows loading. */
		loadingAction = $state<ConfirmAction<unknown> | null>(null);

		constructor() {
			this.executePrimary = this.executePrimary.bind(this);
			this.cancel = this.cancel.bind(this);
		}

		newConfirmation(options: ConfirmOptions<unknown>) {
			this.reset();
			this.options = options;
			this.resolvedActions = getActionList(options);
			this.open = true;
		}

		reset() {
			this.open = false;
			this.inputText = '';
			this.options = null;
			this.resolvedActions = [];
			this.loadingAction = null;
		}

		executeAction(action: ConfirmAction<unknown>) {
			if (this.loadingAction !== null) {
				return;
			}
			if (this.options?.input) {
				if (this.inputText !== this.options.input.confirmationText) {
					return;
				}
			}

			const opts = this.options;
			if (!opts) {
				return;
			}

			this.loadingAction = action;
			runActionHandlers(opts, action)
				.then((ran) => {
					if (ran) {
						this.open = false;
					}
				})
				.finally(() => {
					this.loadingAction = null;
				});
		}

		executePrimary() {
			const list = this.resolvedActions;
			if (list.length === 0) {
				return;
			}
			this.executeAction(list[list.length - 1]);
		}

		cancel() {
			this.options?.onCancel?.();
			this.open = false;
		}
	}

	const dialogState = new ConfirmDialogState();

	function primaryHasHandler<Value>(
		opts: ConfirmOptions<Value>,
		primary: ConfirmAction<Value>,
	): boolean {
		return !!(primary.onClick ?? opts.onConfirm);
	}

	export function confirm<Value = string>(options: ConfirmOptions<Value>) {
		if (options.skipConfirmation) {
			const primary = getPrimaryAction(options);
			void runActionHandlers(options, primary);
			return;
		}

		const primary = getPrimaryAction(options);
		if (!primaryHasHandler(options, primary)) {
			console.error('confirm: primary action needs onClick or dialog-level onConfirm');
			return;
		}

		dialogState.newConfirmation(options as ConfirmOptions<unknown>);
	}
</script>

<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Input } from '$lib/components/ui/input';
	import Button from '$lib/components/ui/button/button.svelte';

	const nonPrimaryActions = $derived(dialogState.resolvedActions.slice(0, -1));
	const primaryAction = $derived(
		dialogState.resolvedActions.length > 0
			? dialogState.resolvedActions[dialogState.resolvedActions.length - 1]
			: null,
	);

	function actionIsBusy(action: ConfirmAction<unknown>) {
		return dialogState.loadingAction === action;
	}

	function actionIsDisabled(action: ConfirmAction<unknown>) {
		const inputBlocked =
			!!dialogState.options?.input &&
			dialogState.inputText !== dialogState.options.input.confirmationText;
		const otherActionLoading =
			dialogState.loadingAction !== null && dialogState.loadingAction !== action;
		return inputBlocked || otherActionLoading;
	}

	const cancelDisabled = $derived(
		dialogState.loadingAction !== null && !dialogState.options?.allowCancelWhileLoading,
	);
</script>

<AlertDialog.Root bind:open={dialogState.open}>
	<AlertDialog.Content class="z-1000">
		<form
			method="POST"
			onsubmit={(e) => {
				e.preventDefault();
				dialogState.executePrimary();
			}}
			class="flex flex-col gap-4"
		>
			<AlertDialog.Header>
				<AlertDialog.Title>
					{dialogState.options?.title}
				</AlertDialog.Title>
				<AlertDialog.Description>
					{dialogState.options?.description}
				</AlertDialog.Description>
			</AlertDialog.Header>
			{#if dialogState.options?.input}
				<Input
					bind:value={dialogState.inputText}
					placeholder={`Skriv \"${dialogState.options.input.confirmationText}\" för att bekräfta.`}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							// for some reason without this the form will submit and the dialog will close immediately
							e.preventDefault();
							dialogState.executePrimary();
						}
					}}
				/>
			{/if}
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">
					{#snippet child({ props })}
						<Button
							{...props}
							variant={dialogState.options?.cancel?.variant ?? 'outline'}
							disabled={cancelDisabled}
							onclick={dialogState.cancel}
						>
							{dialogState.options?.cancel?.text ?? 'Avbryt'}
						</Button>
					{/snippet}
				</AlertDialog.Cancel>
				{#each nonPrimaryActions as action (action.value)}
					<AlertDialog.Action
						type="button"
						variant={action.variant ?? 'outline'}
						loading={actionIsBusy(action)}
						disabled={actionIsDisabled(action)}
						onclick={() => dialogState.executeAction(action)}
					>
						{action.text}
					</AlertDialog.Action>
				{/each}
				{#if primaryAction}
					<AlertDialog.Action
						type="submit"
						variant={primaryAction.variant ?? 'destructive'}
						loading={actionIsBusy(primaryAction)}
						disabled={actionIsDisabled(primaryAction)}
					>
						{primaryAction.text}
					</AlertDialog.Action>
				{/if}
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
