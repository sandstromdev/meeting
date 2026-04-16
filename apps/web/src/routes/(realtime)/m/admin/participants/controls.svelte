<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { useParticipantsContext } from './context.svelte';
	import { api } from '@lsnd/convex/_generated/api';
	import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';
	import RotateCcwKeyIcon from '@lucide/svelte/icons/rotate-ccw-key';
	import UserXIcon from '@lucide/svelte/icons/user-x';
	import { getMeetingContext } from '$lib/context.svelte';
	import { notifyMutation } from '$lib/admin-toast';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { toast } from 'svelte-sonner';

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();
	const accessSettings = meeting.adminQuery(api.meeting.admin.access.getSettings);

	function accessModeLabel(mode: string | undefined) {
		switch (mode) {
			case 'open':
				return 'Öppet';
			case 'closed':
				return 'Stängt';
			case 'invite_only':
				return 'Endast inbjudna';
			default:
				return 'Öppet';
		}
	}

	async function setAccessMode(mode: 'open' | 'closed') {
		const current = accessSettings.data?.accessMode;
		if (current === mode) {
			return;
		}
		await notifyMutation('Åtkomstläge uppdaterat.', () =>
			meeting.adminMutate(api.meeting.admin.access.setMode, { mode }),
		);
	}

	async function runMarkAllPresentAbsent(skipNonParticipants: boolean) {
		try {
			const result = await meeting.adminMutate(
				api.meeting.admin.users.markAllPresentParticipantsAbsent,
				{
					skipNonParticipants,
				},
			);
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

	async function runResetAttendanceState() {
		try {
			await notifyMutation(
				'Närvaroläge har återställts.',
				() => meeting.adminMutate(api.meeting.admin.meeting.resetAttendanceState),
				{
					errorMessage: 'Kunde inte återställa närvaro.',
				},
			);
		} catch (e) {
			console.error(e);
			throw e;
		}
	}

	function handleResetAttendanceState() {
		confirm({
			title: 'Återställ närvaro',
			description:
				'Alla öppna frånvaroperioder stängs, återkomstbegäran rensas och alla markeras som närvarande i systemet. Användbart efter test eller för att städa läget utan att stänga mötet. Detta ändrar inte mötesåtkomst eller lobby.',
			cancel: { text: 'Avbryt' },
			actions: [
				{
					value: 'reset',
					text: 'Återställ',
					variant: 'destructive',
					onClick: () => runResetAttendanceState(),
				},
			],
		});
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
				() => meeting.adminMutate(api.meeting.admin.meeting.recountParticipants),
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
	<Button variant="outline" size="sm" onclick={() => handleResetAttendanceState()}>
		<RotateCcwKeyIcon class="size-4" />
		Återställ närvaro
	</Button>
</div>

{#if meeting.isAdmin && accessSettings.data}
	<div class="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="text-muted-foreground">Mötesåtkomst:</span>
			<span class="font-medium">{accessModeLabel(accessSettings.data.accessMode)}</span>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				variant={accessSettings.data.accessMode === 'open' ? 'default' : 'outline'}
				size="sm"
				onclick={() => setAccessMode('open')}
			>
				Öppet
			</Button>
			<Button
				variant={accessSettings.data.accessMode === 'closed' ? 'default' : 'outline'}
				size="sm"
				onclick={() => setAccessMode('closed')}
			>
				Stängt
			</Button>
		</div>
	</div>
{/if}

{#if accessSettings.data?.canBulkImport}
	<div class="flex flex-wrap gap-2">
		<Button variant="outline" size="sm" onclick={() => (ctx.addUserDialogOpen = true)}>
			<PlusIcon class="size-4" />
			Lägg till användare
		</Button>
		<Button variant="outline" size="sm" onclick={() => (ctx.bulkImportDialogOpen = true)}>
			<UploadIcon class="size-4" />
			Massimportera CSV
		</Button>
	</div>
{/if}
