<script lang="ts">
	import { api } from '@lsnd-mt/convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { notifyMutation } from '$lib/admin-toast';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useQuery } from '@mmailaender/convex-svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const hasBreak = $derived(queue.hasBreak);
	const hasPointOfOrder = $derived(queue.hasPointOfOrder);

	const previousSpeakerResult = useQuery(api.meeting.moderator.meeting.getPreviousSpeaker, () => ({
		meetingId: meeting.meeting._id,
	}));

	const canGoBack = $derived(previousSpeakerResult.data != null);
</script>

<div class="mx-auto w-full max-w-md space-y-2 p-4">
	<div class="grid grid-cols-3 gap-2">
		<Button
			onClickPromise={() => meeting.moderatorMutate(api.meeting.moderator.meeting.previousSpeaker)}
			disabled={hasPointOfOrder || !canGoBack}
			type="button"
			variant="outline"
		>
			<ChevronLeftIcon class="size-4" />
			Senaste
		</Button>
		{#if !queue.break}
			<Button
				onClickPromise={() => meeting.mutate(api.meeting.users.queue.request, { type: 'break' })}
				disabled={!queue.canRequestBreak}
				type="button"
				variant="outline"
			>
				<PauseIcon class="size-4" />
				Streck
			</Button>
		{:else if queue.break.type === 'requested' && queue.break.by.userId === meeting.me._id}
			<Button
				onClickPromise={() =>
					meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'break' })}
				type="button"
				variant="outline"
			>
				<PlayIcon class="size-4" />
				Återkalla
			</Button>
		{:else if queue.break.type === 'accepted'}
			{#if meeting.isAdmin}
				<Button
					onClickPromise={() =>
						notifyMutation('Streck avslutat.', () =>
							meeting.adminMutate(api.meeting.admin.meeting.clearBreak),
						)}
					class="px-3"
					type="button"
					variant="outline"
				>
					<PlayIcon class="size-4" />
					Återuppta
				</Button>
			{:else}
				<Button disabled type="button" variant="outline">
					<PauseIcon class="size-4" />
					Streck
				</Button>
			{/if}
		{:else}
			<Button
				onClickPromise={() => meeting.mutate(api.meeting.users.queue.request, { type: 'break' })}
				type="button"
				variant="outline"
			>
				<PauseIcon class="size-4" />
				Streck
			</Button>
		{/if}
		<Button
			onClickPromise={() => meeting.moderatorMutate(api.meeting.moderator.meeting.nextSpeaker)}
			disabled={hasPointOfOrder || !queue.canAdvance}
			type="button"
			variant="outline"
		>
			Nästa
			<ChevronRightIcon class="size-4" />
		</Button>
	</div>

	{#if meeting.isAdmin && hasPointOfOrder}
		<Button
			onClickPromise={() =>
				notifyMutation('Ordningsfrågan avslutad.', () =>
					meeting.adminMutate(api.meeting.admin.meeting.clearPointOfOrder),
				)}
			class="px-3"
			type="button"
		>
			Avsluta ordningsfråga
		</Button>
	{/if}
</div>
