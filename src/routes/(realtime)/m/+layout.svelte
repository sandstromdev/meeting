<script lang="ts">
	import MeetingPollDialog from '$lib/components/blocks/poll-dialog/meeting-poll-dialog.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Delayed from '$lib/components/ui/delayed.svelte';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
	import MeetingContext from '$lib/meeting-context.svelte';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import LoadingIcon from '@lucide/svelte/icons/loader-circle';
	import type { LayoutProps } from './$types';
	import UserControls from '$lib/components/blocks/user-controls.svelte';
	import AbsentDialog from '$lib/components/ui/absent-dialog.svelte';
	import { resolve } from '$app/paths';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.meeting.data && data.attendance.data}
	<MeetingContext data={data.meeting.data} attendance={data.attendance.data}>
		<AbsentDialog />
		<MeetingPollDialog />
		{@render children()}
		<UserControls />
	</MeetingContext>
{:else}
	<MessageLayout>
		{#if data.meeting.isLoading}
			<p class="flex items-center gap-2">
				<LoadingIcon class="size-4 animate-spin" />
				Laddar...
			</p>

			<Delayed delay={5000}>
				<Button onclick={() => location.reload()}>Ladda om sidan</Button>
			</Delayed>
		{:else}
			<p class="flex items-center gap-2 text-lg font-semibold">
				<AlertTriangleIcon class="size-6" />
				Du har inte tillgång till detta möte.
			</p>

			<Button variant="link" href={resolve('/m/anslut')}>Återgå till anslutningssidan</Button>
		{/if}
	</MessageLayout>
{/if}
