<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { getAppError } from '$convex/helpers/error';
	import { resolve } from '$app/paths';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';

	const meeting = getMeetingContext();

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

	const canLeave = $derived(!meeting.isCurrentSpeaker);
</script>

<nav
	class="flex flex-wrap items-center justify-end gap-2 border-t pt-4"
	aria-label="Användarinställningar"
>
	<Button
		type="button"
		variant="outline"
		size="sm"
		disabled={!canLeave}
		onclick={async () => await leaveMeetingThen('/api/leave-meeting')}
	>
		<DoorOpenIcon class="size-4" />
		Lämna möte
	</Button>
	<Button
		type="button"
		variant="outline"
		size="sm"
		disabled={!canLeave}
		onclick={async () => await leaveMeetingThen('/sign-out')}
	>
		<LogOutIcon class="size-4" />
		Logga ut
	</Button>
</nav>
