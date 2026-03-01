<script lang="ts">
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import AdminInfo from '$lib/layouts/admin/admin-info.svelte';
	import Absentees from '$lib/layouts/admin/absentees.svelte';
	import NotificationsView from '$lib/layouts/admin/notifications-view.svelte';
	import PreviousSpeakers from '$lib/layouts/admin/previous-speakers.svelte';
	import QueueAdminControls from '$lib/layouts/admin/queue-admin-controls.svelte';
	import Requests from '$lib/layouts/admin/requests.svelte';
	import SpeakerLog from '$lib/layouts/admin/speaker-log.svelte';
	import MeetingInfo from '$lib/layouts/common/blocks/meeting-info.svelte';
	import QueueControls from '$lib/layouts/common/blocks/queue-controls.svelte';
	import RequestView from '$lib/layouts/common/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/layouts/common/blocks/speaker-queue.svelte';
	import Timer from '$lib/layouts/common/blocks/timer.svelte';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
</script>

<div class="mx-auto flex h-full max-w-5xl grid-cols-3 flex-col gap-x-4 lg:grid">
	<main class="col-span-2 flex-1 space-y-4">
		<MeetingInfo />
		<Timer />
		<QueueAdminControls />
		<RequestView />
		<QueueControls />
		<SpeakerQueue />
	</main>

	<aside class="col-span-1 flex flex-col rounded-lg border">
		<div class="px-4 py-3 text-lg font-medium">Admin-vy</div>

		<Separator />

		<AdminInfo />

		<Separator />

		<NotificationsView />

		<Separator />

		<Requests />

		<PreviousSpeakers />

		<Separator />

		<Absentees />

		<Separator />

		<SpeakerLog />

		<Separator />
	</aside>
</div>
