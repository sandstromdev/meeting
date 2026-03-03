<script lang="ts">
	import Absentees from '$lib/components/blocks/admin/absentees.svelte';
	import AdminInfo from '$lib/components/blocks/admin/admin-info.svelte';
	import Notifications from '$lib/components/blocks/admin/notifications.svelte';
	import Requests from '$lib/components/blocks/admin/requests.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import PreviousSpeaker from '$lib/components/blocks/admin/previous-speaker.svelte';
	import ParticipantView from '$lib/views/participant-view.svelte';
	import SpeakerLog from '$lib/components/blocks/admin/speaker-log.svelte';
	import ViewSelector from '$lib/components/blocks/admin/view-selector.svelte';
	import QueueAdminControls from '$lib/components/blocks/admin/queue-admin-controls.svelte';
</script>

<div class="mx-auto flex h-full max-w-2xl grid-cols-3 flex-col gap-4 lg:grid lg:max-w-6xl">
	<div class="col-start-3 flex justify-end">
		<ViewSelector compact />
	</div>

	<ParticipantView class="col-span-2" useAdminAgenda />

	<aside class="col-span-1 flex flex-col rounded-lg border">
		<div class="px-4 py-3 text-lg font-medium">Admin-vy</div>

		<Separator />

		<AdminInfo />

		<Separator />

		<QueueAdminControls />

		<Separator />

		<Notifications />

		<Separator />

		<Requests />

		<PreviousSpeaker />

		<Separator />

		<Absentees />

		<Separator />

		<SpeakerLog />
	</aside>
</div>
