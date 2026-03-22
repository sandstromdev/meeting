<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { useParticipantsContext } from './context.svelte';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '$convex/_generated/api';
	import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';
	import UserXIcon from '@lucide/svelte/icons/user-x';
	import { getMeetingContext } from '$lib/context.svelte';
	import { notifyMutation } from '$lib/admin-toast';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { toast } from 'svelte-sonner';

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();

	const currentUser = useQuery(api.me.getCurrentUser);

	const otherPresentCount = $derived(
		ctx.participants.filter((p) => p.absentSince === 0 && p._id !== meeting.me._id).length,
	);

	async function runMarkAllPresentAbsent(skipNonParticipants: boolean) {
		try {
			await new Promise((resolve) => setTimeout(resolve, 4000));
			return;

			const result = await meeting.adminMutate(api.admin.users.markAllPresentParticipantsAbsent, {
				skipNonParticipants,
			});
			const marked = result?.marked ?? 0;
			toast.success(
				marked === 0
					? 'Ingen var närvarande att markera.'
					: `${marked} deltagare markerades som frånvarande.`,
			);
		} catch (e) {
			console.error(e);
			toast.error('Kunde inte markera alla som frånvarande.');
			throw e;
		}
	}

	function handleMarkEveryoneAbsent() {
		confirm({
			title: 'Markera alla frånvarande',
			description:
				'Alla andra närvarande markeras som frånvarande (du själv inte). De som står i talarkön tas bort från kön. Du kan i stället bara påverka personer med rollen Deltagare — admin, moderator och justerare lämnas närvarande.',
			cancel: { text: 'Avbryt' },
			actions: [
				{
					value: 'participants-only',
					text: 'Endast deltagarroll',
					variant: 'default',
					onClick: () => runMarkAllPresentAbsent(true),
				},
				{
					value: 'all',
					text: 'Markera alla',
					variant: 'destructive',
					onClick: () => runMarkAllPresentAbsent(false),
				},
			],
		});
	}
</script>

<div class="flex flex-wrap gap-2">
	<Button
		variant="outline"
		size="sm"
		onClickPromise={() =>
			notifyMutation(
				'Deltagare har räknats om.',
				() => meeting.adminMutate(api.admin.meeting.recountParticipants),
				{ errorMessage: 'Kunde inte räkna om deltagare.' },
			)}
	>
		<RefreshCcwIcon class="size-4" />
		Räkna om deltagare
	</Button>
	<Button variant="outline" size="sm" onclick={() => handleMarkEveryoneAbsent()}>
		<UserXIcon class="size-4" />
		Markera alla frånvarande
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
