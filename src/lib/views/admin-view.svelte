<script lang="ts">
	import Absentees from '$lib/components/blocks/admin/absentees.svelte';
	import AdminInfo from '$lib/components/blocks/admin/admin-info.svelte';
	import Notifications from '$lib/components/blocks/admin/notifications.svelte';
	import PreviousSpeaker from '$lib/components/blocks/admin/previous-speaker.svelte';
	import QueueAdminControls from '$lib/components/blocks/admin/queue-admin-controls.svelte';
	import Requests from '$lib/components/blocks/admin/requests.svelte';
	import MeetingControl from '$lib/components/blocks/admin/meeting-control.svelte';
	import SpeakerLog from '$lib/components/blocks/admin/speaker-log.svelte';
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import CurrentAgendaPolls from '$lib/components/blocks/admin/current-agenda-polls.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
</script>

<div class="mx-auto flex h-full max-w-[90vw] grid-cols-4 flex-col gap-4 lg:grid">
	<aside class="col-span-1 flex flex-col rounded-lg border">
		<QueueAdminControls />
		<Separator />
		<SpeakerQueue noBorder />
		<Separator />
	</aside>

	<main class="col-span-2 flex flex-col gap-4">
		<MeetingInfo />
		<CurrentAgendaItem />
		<CurrentAgendaPolls />
		<Timer />
		<Agenda />
		<RequestView />
		<QueueControls />
	</main>

	<aside class="col-span-1 flex flex-col rounded-lg border">
		<div class="px-4 py-3 text-lg font-medium">Admin-vy</div>

		<Separator />

		<AdminInfo />

		<Separator />

		<Notifications />

		<Separator />

		<Requests />

		<PreviousSpeaker />

		<Separator />

		<Absentees />

		<Separator />

		<SpeakerLog />

		<Separator />

		<MeetingControl />
	</aside>
</div>
