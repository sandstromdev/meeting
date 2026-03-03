<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useQuery } from 'convex-svelte';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const hasBreak = $derived(queue.hasBreak);
	const hasPointOfOrder = $derived(queue.hasPointOfOrder);

	const previousSpeakerResult = useQuery(api.admin.meeting.getPreviousSpeaker, () => ({
		meetingId: meeting.meeting._id,
	}));

	const canGoBack = $derived(previousSpeakerResult.data != null);
</script>

<div class="space-y-2 px-4 py-3">
	<h2 class="text-lg font-semibold">Talarlista</h2>

	<div class="grid grid-cols-3 gap-2">
		<Button
			onClickPromise={() => meeting.adminMutate(api.admin.meeting.previousSpeaker)}
			disabled={hasPointOfOrder || !canGoBack}
			type="button"
			variant="outline"
		>
			<ChevronLeftIcon class="size-4" />
			Senaste
		</Button>
		{#if !queue.break}
			<Button
				onClickPromise={() => meeting.mutate(api.users.meeting.requestBreak)}
				disabled={!queue.canRequestBreak}
				type="button"
				variant="outline"
			>
				<PauseIcon class="size-4" />
				Streck
			</Button>
		{:else if queue.break.type === 'requested' && queue.break.by.userId === meeting.me._id}
			<Button
				onClickPromise={() => meeting.mutate(api.users.meeting.recallBreakRequest)}
				type="button"
				variant="outline"
			>
				<PlayIcon class="size-4" />
				Återkalla
			</Button>
		{:else if queue.break.type === 'accepted'}
			<Button
				onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearBreak)}
				class="px-3"
				type="button"
				variant="outline"
			>
				<PlayIcon class="size-4" />
				Återuppta
			</Button>
		{:else}
			<Button
				onClickPromise={() => meeting.mutate(api.users.meeting.requestBreak)}
				type="button"
				variant="outline"
			>
				<PauseIcon class="size-4" />
				Streck
			</Button>
		{/if}
		<Button
			onClickPromise={() => meeting.adminMutate(api.admin.meeting.nextSpeaker)}
			disabled={hasPointOfOrder || !queue.canAdvance}
			type="button"
			variant="outline"
		>
			Nästa
			<ChevronRightIcon class="size-4" />
		</Button>
	</div>

	{#if hasPointOfOrder}
		<Button
			onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearPointOfOrder)}
			class="px-3"
			type="button"
		>
			Avsluta ordningsfråga
		</Button>
	{/if}

	{#if hasBreak}
		<Button
			onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearBreak)}
			class="px-3"
			disabled={!hasBreak}
			type="button"
		>
			Avsluta streck
		</Button>
	{/if}
</div>
