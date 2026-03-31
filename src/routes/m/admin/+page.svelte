<script lang="ts">
	import { resolve } from '$app/paths';
	import Absentees from '$lib/components/blocks/admin/absentees.svelte';
	import AdminInfo from '$lib/components/blocks/admin/admin-info.svelte';
	import CurrentAgendaPolls from '$lib/components/blocks/admin/current-agenda-polls.svelte';
	import MeetingControl from '$lib/components/blocks/admin/meeting-control.svelte';
	import Notifications from '$lib/components/blocks/admin/notifications.svelte';
	import PreviousSpeaker from '$lib/components/blocks/admin/previous-speaker.svelte';
	import QueueAdminControls from '$lib/components/blocks/admin/queue-admin-controls.svelte';
	import Requests from '$lib/components/blocks/admin/requests.svelte';
	import SpeakerLog from '$lib/components/blocks/admin/speaker-log.svelte';
	import Agenda from '$lib/components/blocks/agenda.svelte';
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import QueueControls from '$lib/components/blocks/queue-controls.svelte';
	import RequestView from '$lib/components/blocks/request-view.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import UsersIcon from '@lucide/svelte/icons/users';

	const adminCtx = getMeetingContext();
</script>

<SeoHead
	title={`${adminCtx.meeting.title} – Administration`}
	description="Administration: styr mötet, dagordning och deltagare."
/>

<div class="mx-auto flex h-full max-w-[90vw] grid-cols-4 flex-col gap-4 p-4 lg:grid lg:py-12">
	<aside class="col-span-1 flex flex-col rounded-lg border">
		<h2 class="px-4 py-3 text-lg font-semibold">Kökontroll</h2>
		<QueueControls noBorder size="sm" />
		<Separator />
		<QueueAdminControls />
		<Separator />
		<SpeakerQueue noBorder />
	</aside>

	<main class="col-span-2 flex flex-col gap-4">
		<MeetingInfo />
		<Timer />
		<CurrentAgendaItem />
		<CurrentAgendaPolls />
		<Agenda />
		<RequestView />
	</main>

	<aside class="col-span-1 flex flex-col rounded-lg border">
		<div class="px-4 py-3 text-lg font-medium">Admin-vy</div>

		<Separator />

		<AdminInfo />

		<Separator />

		<div class="px-4 py-3">
			<Button
				href={resolve('/m/admin/participants')}
				variant="outline"
				size="sm"
				class="w-full gap-2"
			>
				<UsersIcon class="size-4" />
				Hantera deltagare
			</Button>
		</div>

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
