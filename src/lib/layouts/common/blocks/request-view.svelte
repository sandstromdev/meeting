<script lang="ts">
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import MicIcon from '@lucide/svelte/icons/mic';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import LogInIcon from '@lucide/svelte/icons/log-in';

	const meeting = getMeetingContext();
	const me = $derived(meeting.me);
	const m = $derived(meeting.meeting);

	const hasRequestedReply = $derived(m.reply?.type === 'requested' && m.reply.by.userId === me._id);
	const hasRequestedPointOfOrder = $derived(
		m.pointOfOrder?.type === 'requested' && m.pointOfOrder.by.userId === me._id,
	);
	const isInSpeakerQueue = $derived(me.isInSpeakerQueue && !meeting.isCurrentSpeaker);
	const hasRequestedBreak = $derived(m.break?.type === 'requested' && m.break.by.userId === me._id);
	const hasPendingReturnRequest = $derived(meeting.hasPendingReturnRequest);

	const hasAnyRequest = $derived(
		hasRequestedReply ||
			hasRequestedPointOfOrder ||
			isInSpeakerQueue ||
			hasRequestedBreak ||
			hasPendingReturnRequest,
	);
</script>

{#if hasAnyRequest}
	<div class="space-y-2">
		{#if hasRequestedReply}
			<Alert variant="default">
				<MessageSquareIcon />
				<AlertTitle>Begäran skickad</AlertTitle>
				<AlertDescription>Du har begärt replik och väntar på godkännande.</AlertDescription>
			</Alert>
		{/if}
		{#if hasRequestedPointOfOrder}
			<Alert variant="default">
				<ListOrderedIcon />
				<AlertTitle>Begäran skickad</AlertTitle>
				<AlertDescription>Du har begärt ordningsfråga och väntar på godkännande.</AlertDescription>
			</Alert>
		{/if}
		{#if isInSpeakerQueue}
			<Alert variant="default">
				<MicIcon />
				<AlertTitle>I talarkön</AlertTitle>
				<AlertDescription>Du står i talarkön och väntar på din tur.</AlertDescription>
			</Alert>
		{/if}
		{#if hasRequestedBreak}
			<Alert variant="default">
				<PauseIcon />
				<AlertTitle>Förslag skickat</AlertTitle>
				<AlertDescription
					>Du har föreslagit ett streck i debatten och väntar på godkännande.</AlertDescription
				>
			</Alert>
		{/if}
		{#if hasPendingReturnRequest}
			<Alert variant="default">
				<LogInIcon />
				<AlertTitle>Begäran skickad</AlertTitle>
				<AlertDescription
					>Du har begärt återkomst till mötet och väntar på godkännande.</AlertDescription
				>
			</Alert>
		{/if}
	</div>
{/if}
