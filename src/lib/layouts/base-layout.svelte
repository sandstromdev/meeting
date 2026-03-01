<script lang="ts">
	import { dev } from '$app/environment';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { devState } from '$lib/dev.svelte';
	import AdminLayout from '$lib/layouts/admin/admin-layout.svelte';
	import MeetingContext from '$lib/layouts/common/meeting-context.svelte';
	import ParticipantLayout from '$lib/layouts/participant/participant-layout.svelte';
	import LoadingIcon from '@lucide/svelte/icons/loader-circle';
	import { useQuery } from 'convex-svelte';

	let {
		meetingId,
		initialData,
	}: {
		meetingId: Id<'meetings'>;
		initialData: typeof api.users.meeting.getData._returnType | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	const dataResult = useQuery(api.users.meeting.getData, () => ({ meetingId }), {
		initialData: initialData ?? undefined,
	});

	const data = $derived(dataResult.data);
	const meeting = $derived(data?.meeting ?? null);
	const me = $derived(data?.me ?? null);

	const isAdmin = $derived(
		!me?.isAdmin ? false : (dev && devState.view === 'admin') || (!dev && me.isAdmin),
	);

	const prevSpeakersResult = useQuery(api.admin.meeting.getPreviousSpeakers, () =>
		isAdmin ? { meetingId } : 'skip',
	);

	const pointOfOrderResult = useQuery(api.admin.meeting.getPointOfOrderEntries, () =>
		isAdmin ? { meetingId } : 'skip',
	);

	const speakerLogResult = useQuery(api.admin.meeting.getSpeakerLogEntries, () =>
		isAdmin ? { meetingId } : 'skip',
	);

	const absenceEntriesResult = useQuery(api.admin.meeting.getAbsenceEntries, () =>
		isAdmin ? { meetingId } : 'skip',
	);

	const returnRequestsResult = useQuery(api.admin.meeting.getReturnRequests, () =>
		isAdmin ? { meetingId } : 'skip',
	);
</script>

{#if meeting && me}
	<div class="mx-auto p-4 lg:py-12">
		<MeetingContext
			{meeting}
			{me}
			nextSpeakers={data?.nextSpeakers ?? []}
			previousSpeakers={isAdmin ? (prevSpeakersResult.data ?? []) : []}
			pointOfOrderEntries={isAdmin ? (pointOfOrderResult.data ?? []) : []}
			speakerLogEntries={isAdmin ? (speakerLogResult.data ?? []) : []}
			absenceEntries={isAdmin ? (absenceEntriesResult.data ?? []) : []}
			hasPendingReturnRequest={data?.hasPendingReturnRequest ?? false}
			returnRequests={isAdmin ? (returnRequestsResult.data ?? []) : []}
		>
			{#if isAdmin}
				<AdminLayout />
			{:else}
				<ParticipantLayout />
			{/if}
		</MeetingContext>
	</div>
{:else}
	<div class="flex min-h-[50vh] flex-col items-center justify-center">
		<p class="flex items-center gap-2">
			<LoadingIcon class="size-4 animate-spin" />
			Loading...
		</p>
	</div>
{/if}
