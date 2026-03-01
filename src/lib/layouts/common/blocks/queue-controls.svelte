<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;

	const isInQueue = $derived(meeting.me.isInSpeakerQueue);
	const isCurrentSpeaker = $derived(meeting.data.meeting.currentSpeaker?.userId === meeting.me._id);

	const canJoinQueue = $derived(
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

<div class="flex flex-col gap-4 rounded-lg border p-4">
	<div class="flex">
		{#if queue.isCurrentSpeaker}
			<Button class="mx-auto h-12 w-full" size="lg" onClickPromise={() => queue.doneSpeaking()}>
				Klar
			</Button>
		{:else}
			<Button
				class="mx-auto h-12 w-full"
				size="lg"
				disabled={!isCurrentSpeaker && !canJoinQueue && !isInQueue}
				onClickPromise={() =>
					isCurrentSpeaker
						? queue.doneSpeaking()
						: isInQueue
							? queue.recallFromQueue()
							: queue.placeInQueue()}
			>
				{#if isInQueue}
					<LogOutIcon class="size-4" />
					Ta mig ur kön
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
				class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
			>
				<h2 class="font-semibold">Avancerat</h2>
				<ChevronDownIcon class="size-4 shrink-0 transition-transform " />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div class="grid items-center gap-3 border-t p-3 md:grid-cols-3">
					{#if queue.canRequestPointOfOrder}
						<Button
							variant="outline"
							size="lg"
							onClickPromise={() => queue.requestPointOfOrder()}
							type="button"
						>
							Ordningsfråga
						</Button>
					{:else if queue.canRecallPointOfOrder}
						<Button
							variant="outline"
							size="lg"
							onClickPromise={() => queue.recallPointOfOrderRequest()}
							type="button"
						>
							Återkalla ordningsfråga
						</Button>
					{/if}
					{#if queue.canRequestReply}
						<Button
							variant="outline"
							size="lg"
							onClickPromise={() => queue.requestReply()}
							type="button"
						>
							Begär replik
						</Button>
					{:else if queue.canRecallReplyRequest}
						<Button
							variant="outline"
							size="lg"
							onClickPromise={() => queue.recallReplyRequest()}
							type="button"
						>
							Återkalla replik
						</Button>
					{/if}
					{#if !hasRequestedBreak}
						<Button
							disabled={!queue.canRequestBreak}
							variant="outline"
							size="lg"
							onClickPromise={() => queue.requestBreak()}
							type="button"
						>
							Föreslå streck
						</Button>
					{:else}
						<Button
							variant="outline"
							size="lg"
							onClickPromise={() => queue.recallBreakRequest()}
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

	{#if meeting.me.absentSince}
		{#if meeting.hasPendingReturnRequest}
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-center gap-2 text-muted-foreground">
					<LoaderCircle class="size-4 animate-spin" />
					Väntar på godkännande
				</div>
				<Button
					variant="outline"
					size="lg"
					onClickPromise={() => queue.recallReturnRequest()}
					type="button"
				>
					Återkalla begäran
				</Button>
			</div>
		{:else}
			<Button
				variant="outline"
				size="lg"
				onClickPromise={() => queue.requestReturnToMeeting()}
				type="button"
			>
				Begär återkomst
			</Button>
		{/if}
	{:else}
		<Button
			variant="outline"
			size="lg"
			disabled={!canMarkAbsent}
			onClickPromise={() => queue.leaveMeeting()}
			type="button"
		>
			<LogOutIcon class="size-4" />
			Markera frånvaro
		</Button>
	{/if}
</div>
