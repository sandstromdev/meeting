<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { cn } from '$lib/utils';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let {
		noBorder = false,
		size = 'lg',
		absentSince,
		isInQueue,
		isFloorSpeaker,
		isQueuedCurrentSpeaker,
		canJoinQueue,
		canRequestPointOfOrder,
		canRecallPointOfOrder,
		canRequestReply,
		canRecallReply,
		canRequestBreak,
		hasRequestedBreak,
		canMarkAbsent,
		actionBusy = false,
		onDoneSpeaking,
		onJoinQueue,
		onLeaveQueue,
		onRequestPointOfOrder,
		onRecallPointOfOrder,
		onRequestReply,
		onRecallReply,
		onRequestBreak,
		onRecallBreak,
		onMarkAbsent,
	}: {
		noBorder?: boolean;
		size?: 'lg' | 'sm';
		absentSince: number;
		isInQueue: boolean;
		isFloorSpeaker: boolean;
		isQueuedCurrentSpeaker: boolean;
		canJoinQueue: boolean;
		canRequestPointOfOrder: boolean;
		canRecallPointOfOrder: boolean;
		canRequestReply: boolean;
		canRecallReply: boolean;
		canRequestBreak: boolean;
		hasRequestedBreak: boolean;
		canMarkAbsent: boolean;
		actionBusy?: boolean;
		onDoneSpeaking: () => Promise<unknown>;
		onJoinQueue: () => Promise<unknown>;
		onLeaveQueue: () => Promise<unknown>;
		onRequestPointOfOrder: () => Promise<unknown>;
		onRecallPointOfOrder: () => Promise<unknown>;
		onRequestReply: () => Promise<unknown>;
		onRecallReply: () => Promise<unknown>;
		onRequestBreak: () => Promise<unknown>;
		onRecallBreak: () => Promise<unknown>;
		onMarkAbsent: () => Promise<unknown>;
	} = $props();

	const showRequestGrid = $derived(!absentSince);
	const showMarkAbsent = $derived(absentSince <= 0);
</script>

<div
	class={cn(
		' mx-auto flex w-full max-w-md flex-col p-4',
		!noBorder && 'rounded-lg border',
		size === 'sm' ? 'gap-2' : 'gap-4',
	)}
>
	<div class="flex">
		{#if isFloorSpeaker}
			<Button class="mx-auto w-full" {size} disabled={actionBusy} onClickPromise={onDoneSpeaking}>
				Klar
			</Button>
		{:else}
			<Button
				class="mx-auto w-full"
				{size}
				disabled={actionBusy || (!isQueuedCurrentSpeaker && !canJoinQueue && !isInQueue)}
				onClickPromise={() =>
					isQueuedCurrentSpeaker ? onDoneSpeaking() : isInQueue ? onLeaveQueue() : onJoinQueue()}
			>
				{#if isInQueue}
					<LogOutIcon class="size-4" />
					Gå ur kön
				{:else}
					<PlusIcon class="size-4" />
					Ställ dig i kön
				{/if}
			</Button>
		{/if}
	</div>

	<Separator />

	{#if showRequestGrid}
		<div class="grid items-center gap-x-2 gap-y-2 sm:grid-cols-3">
			{#if canRequestPointOfOrder}
				<Button
					variant="outline"
					{size}
					disabled={actionBusy}
					onClickPromise={onRequestPointOfOrder}
					type="button"
					class="truncate"
				>
					Ordningsf.
				</Button>
			{:else if canRecallPointOfOrder}
				<Button
					variant="outline"
					{size}
					disabled={actionBusy}
					onClickPromise={onRecallPointOfOrder}
					type="button"
				>
					Återkalla fråga
				</Button>
			{/if}
			{#if canRequestReply}
				<Button
					variant="outline"
					{size}
					disabled={actionBusy}
					onClickPromise={onRequestReply}
					type="button"
				>
					Replik
				</Button>
			{:else if canRecallReply}
				<Button
					variant="outline"
					{size}
					disabled={actionBusy}
					onClickPromise={onRecallReply}
					type="button"
				>
					Återkalla replik
				</Button>
			{/if}
			{#if !hasRequestedBreak}
				<Button
					disabled={actionBusy || !canRequestBreak}
					variant="outline"
					{size}
					onClickPromise={onRequestBreak}
					type="button"
				>
					Streck
				</Button>
			{:else}
				<Button
					variant="outline"
					{size}
					disabled={actionBusy}
					onClickPromise={onRecallBreak}
					type="button"
				>
					Återkalla streck
				</Button>
			{/if}
		</div>

		<Separator />
	{/if}

	{#if showMarkAbsent}
		<Button
			variant="outline"
			{size}
			disabled={actionBusy || !canMarkAbsent}
			onclick={() =>
				confirm({
					title: 'Markera frånvaro från mötet?',
					description: isInQueue
						? 'Om du lämnar mötet kommer du förlora din plats i kön. För att komma tillbaka behöver du bli godkänd av mötesadmin.'
						: 'För att komma tillbaka behöver du bli godkänd av mötesadmin.',
					onConfirm: onMarkAbsent,
				})}
			type="button"
		>
			<LogOutIcon class="size-4" />
			Markera frånvaro
		</Button>
	{/if}
</div>
