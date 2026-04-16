<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { getMeetingContext } from '$lib/context.svelte';
	import QueueControlsView from './queue-controls-view.svelte';

	let { noBorder = false, size = 'lg' }: { noBorder?: boolean; size?: 'lg' | 'sm' } = $props();

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;

	const absentSince = $derived(meeting.me.absentSince);
	const isInQueue = $derived(meeting.me.isInSpeakerQueue);
	const isFloorSpeaker = $derived(queue.isCurrentSpeaker);
	const isQueuedCurrentSpeaker = $derived(
		meeting.data.meeting.currentSpeaker?.userId === meeting.me._id,
	);

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

<QueueControlsView
	{noBorder}
	{size}
	{absentSince}
	{isInQueue}
	{isFloorSpeaker}
	{isQueuedCurrentSpeaker}
	{canJoinQueue}
	canRequestPointOfOrder={queue.canRequestPointOfOrder}
	canRecallPointOfOrder={queue.canRecallPointOfOrder}
	canRequestReply={queue.canRequestReply}
	canRecallReply={queue.canRecallReplyRequest}
	canRequestBreak={queue.canRequestBreak}
	{hasRequestedBreak}
	{canMarkAbsent}
	onDoneSpeaking={() => meeting.mutate(api.meeting.users.queue.doneSpeaking)}
	onJoinQueue={() => meeting.mutate(api.meeting.users.queue.placeInSpeakerQueue)}
	onLeaveQueue={() => meeting.mutate(api.meeting.users.queue.recallSpeakerQueueRequest)}
	onRequestPointOfOrder={() =>
		meeting.mutate(api.meeting.users.queue.request, { type: 'pointOfOrder' })}
	onRecallPointOfOrder={() =>
		meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'pointOfOrder' })}
	onRequestReply={() => meeting.mutate(api.meeting.users.queue.request, { type: 'reply' })}
	onRecallReply={() => meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'reply' })}
	onRequestBreak={() => meeting.mutate(api.meeting.users.queue.request, { type: 'break' })}
	onRecallBreak={() => meeting.mutate(api.meeting.users.queue.recallRequest, { type: 'break' })}
	onMarkAbsent={() => meeting.mutate(api.meeting.users.attendance.leaveMeeting)}
/>
