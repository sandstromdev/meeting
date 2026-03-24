<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { cn } from '$lib/utils';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { noBorder = false, size = 'lg' }: { noBorder?: boolean; size?: 'lg' | 'sm' } = $props();

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;

	const isInQueue = $derived(meeting.me.isInSpeakerQueue);
	const isCurrentSpeaker = $derived(meeting.data.meeting.currentSpeaker?.userId === meeting.me._id);

	const canJoinQueue = $derived(
		meeting.isOpen &&
			!meeting.me.absentSince &&
			!meeting.me.isInSpeakerQueue &&
			meeting.meeting.break?.type !== 'accepted' &&
			meeting.meeting.pointOfOrder?.type !== 'accepted' &&
			meeting.meeting.reply?.type !== 'accepted',
	);

	const canMarkAbsent = $derived(!meeting.me.absentSince && !queue.isCurrentSpeaker);

	const hasRequestedBreak = $derived(
		meeting.meeting.break?.type === 'requested' &&
			meeting.meeting.break.by.userId === meeting.me._id,
	);
</script>

<div
	class={cn(
		'flex flex-col p-4',
		!noBorder && 'rounded-lg border',
		size === 'sm' ? 'gap-2' : 'gap-4',
	)}
>
	<div class="flex">
		{#if queue.isCurrentSpeaker}
			<Button
				class="mx-auto w-full"
				{size}
				onClickPromise={() => meeting.mutate(api.meeting.users.queue.doneSpeaking)}
			>
				Klar
			</Button>
		{:else}
			<Button
				class="mx-auto w-full"
				{size}
				disabled={!isCurrentSpeaker && !canJoinQueue && !isInQueue}
				onClickPromise={() =>
					isCurrentSpeaker
						? meeting.mutate(api.meeting.users.queue.doneSpeaking)
						: isInQueue
							? meeting.mutate(api.meeting.users.queue.recallSpeakerQueueRequest)
							: meeting.mutate(api.meeting.users.queue.placeInSpeakerQueue)}
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

	{#if !meeting.me.absentSince}
		<Collapsible class="rounded-lg border">
			<CollapsibleTrigger
				class={cn(
					'flex w-full items-center justify-between px-4 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180',
					size === 'sm' ? 'h-8 text-sm' : 'h-12 text-base',
				)}
			>
				<h2 class="font-semibold">Avancerat</h2>
				<ChevronDownIcon class="size-4 shrink-0 transition-transform " />
			</CollapsibleTrigger>
			<CollapsibleContent class="@container">
				<div class="grid items-center gap-x-3 gap-y-2 border-t p-3 @sm:grid-cols-3">
					{#if queue.canRequestPointOfOrder}
						<Button
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.request, { type: 'pointOfOrder' })}
							type="button"
						>
							Ordningsfråga
						</Button>
					{:else if queue.canRecallPointOfOrder}
						<Button
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'pointOfOrder' })}
							type="button"
						>
							Återkalla ordningsfråga
						</Button>
					{/if}
					{#if queue.canRequestReply}
						<Button
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.request, { type: 'reply' })}
							type="button"
						>
							Begär replik
						</Button>
					{:else if queue.canRecallReplyRequest}
						<Button
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'reply' })}
							type="button"
						>
							Återkalla replik
						</Button>
					{/if}
					{#if !hasRequestedBreak}
						<Button
							disabled={!queue.canRequestBreak}
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.request, { type: 'break' })}
							type="button"
						>
							Föreslå streck
						</Button>
					{:else}
						<Button
							variant="outline"
							{size}
							onClickPromise={() =>
								meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'break' })}
							type="button"
						>
							Återkalla streck
						</Button>
					{/if}
				</div>
			</CollapsibleContent>
		</Collapsible>

		<Separator />
	{/if}

	{#if !meeting.isAbsent}
		<Button
			variant="outline"
			{size}
			disabled={!canMarkAbsent}
			onclick={() =>
				confirm({
					title: 'Markera frånvaro från mötet?',
					description: isInQueue
						? 'Om du lämnar mötet kommer du förlora din plats i kön. För att komma tillbaka behöver du bli godkänd av mötesadmin.'
						: 'För att komma tillbaka behöver du bli godkänd av mötesadmin.',
					onConfirm: () => meeting.mutate(api.meeting.users.attendance.leaveMeeting),
				})}
			type="button"
		>
			<LogOutIcon class="size-4" />
			Markera frånvaro
		</Button>
	{/if}
</div>
