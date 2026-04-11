<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { cn } from '$lib/utils';
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
		' mx-auto flex w-full max-w-md flex-col p-4',
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
		<div class="grid items-center gap-x-2 gap-y-2 sm:grid-cols-3">
			{#if queue.canRequestPointOfOrder}
				<Button
					variant="outline"
					{size}
					onClickPromise={() =>
						meeting.mutate(api.meeting.users.queue.request, { type: 'pointOfOrder' })}
					type="button"
					class="truncate"
				>
					Ordningsf.
				</Button>
			{:else if queue.canRecallPointOfOrder}
				<Button
					variant="outline"
					{size}
					onClickPromise={() =>
						meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'pointOfOrder' })}
					type="button"
				>
					Återkalla fråga
				</Button>
			{/if}
			{#if queue.canRequestReply}
				<Button
					variant="outline"
					{size}
					onClickPromise={() => meeting.mutate(api.meeting.users.queue.request, { type: 'reply' })}
					type="button"
				>
					Replik
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
					onClickPromise={() => meeting.mutate(api.meeting.users.queue.request, { type: 'break' })}
					type="button"
				>
					Streck
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
