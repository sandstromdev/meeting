<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { getAppError } from '$convex/helpers/error';
	import { resolve } from '$app/paths';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { usePageState } from '$lib/page-state.svelte';

	const meeting = getMeetingContext();

	const ps = usePageState();

	async function leaveMeetingThen(path: '/api/leave-meeting' | '/sign-out') {
		try {
			await meeting.mutate(api.users.attendance.leaveMeeting);
			window.location.href = resolve(path);
		} catch (e) {
			const appErr = getAppError(e);
			if (appErr) {
				alert(appErr.message);
			} else {
				throw e;
			}
		}
	}

	function leaveMeeting() {
		confirm({
			title: 'Lämna mötet?',
			description:
				'Du kommer att lämna mötet. Om du vill komma tillbaka måste en administratör godkänna dig.',
			confirm: { text: 'Lämna möte' },
			onConfirm: () => leaveMeetingThen('/api/leave-meeting'),
		});
	}

	function signOut() {
		confirm({
			title: 'Logga ut?',
			description:
				'Du kommer att lämna mötet och loggas ut från ditt konto. Om du vill komma tillbaka måste en administratör godkänna dig.',
			confirm: { text: 'Logga ut' },
			onConfirm: () => leaveMeetingThen('/sign-out'),
		});
	}

	const canLeave = $derived(!meeting.isCurrentSpeaker);
</script>

{#if !ps.isProjector}
	<nav
		class="flex flex-wrap items-center justify-end gap-2 border-t pt-4"
		aria-label="Användarinställningar"
	>
		<Button type="button" variant="outline" size="sm" disabled={!canLeave} onclick={leaveMeeting}>
			<DoorOpenIcon class="size-4" />
			Lämna möte
		</Button>
		<Button type="button" variant="outline" size="sm" disabled={!canLeave} onclick={signOut}>
			<LogOutIcon class="size-4" />
			Logga ut
		</Button>
	</nav>
{/if}
