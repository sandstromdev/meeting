<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useParticipantsContext } from './context.svelte';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '$convex/_generated/api';
	import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';
	import { getMeetingContext } from '$lib/context.svelte';

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();

	const currentUser = useQuery(api.me.getCurrentUser);
</script>

<div class="flex flex-wrap gap-2">
	<Button
		variant="outline"
		size="sm"
		onClickPromise={() => meeting.adminMutate(api.admin.meeting.recountParticipants)}
	>
		<RefreshCcwIcon class="size-4" />
		Räkna om deltagare
	</Button>
</div>

{#if currentUser?.data?.role === 'admin'}
	<div class="flex flex-wrap gap-2">
		<Button variant="outline" size="sm" onclick={() => (ctx.addUserDialogOpen = true)}>
			<PlusIcon class="size-4" />
			Lägg till användare
		</Button>
	</div>
{/if}
