<script lang="ts">
	import PollDialog from '$lib/components/blocks/poll-dialog.svelte';
	import ConfirmDialog from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Delayed from '$lib/components/ui/delayed.svelte';
	import MessageLayout from '$lib/components/ui/message-layout.svelte';
	import MeetingContext from '$lib/meeting-context.svelte';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import LoadingIcon from '@lucide/svelte/icons/loader-circle';
	import type { LayoutProps } from './$types';
	import UserControls from '$lib/components/blocks/user-controls.svelte';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.meeting.data}
	<MeetingContext data={data.meeting.data}>
		<PollDialog />
		<ConfirmDialog />
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

			<Button variant="link" href="/anslut">Återgå till anslutningssidan</Button>
		{/if}
	</MessageLayout>
{/if}
