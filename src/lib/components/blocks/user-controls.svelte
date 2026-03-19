<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import * as auth from '$lib/auth-client';
	import Button from '$lib/components/ui/button/button.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import UserIcon from '@lucide/svelte/icons/user';

	const meeting = getMeetingContext();
	const ps = usePageState();

	async function leaveMeeting() {
		await meeting.mutate(api.users.attendance.leaveMeeting);

		await auth.leaveMeeting();

		goto(resolve('/anslut'));
	}

	async function signOut() {
		await meeting.mutate(api.users.attendance.leaveMeeting);

		await auth.signOut();

		goto(resolve('/sign-in'));
	}

	const canLeave = $derived(!meeting.isCurrentSpeaker);
</script>

{#if !ps.isProjector}
	<nav class="flex flex-wrap items-center gap-2 border-t p-4" aria-label="Användarinställningar">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button type="button" variant="outline" size="sm" {...props}>
						<UserIcon class="size-4" />
						{meeting.me.name}
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Item>
					<LogOutIcon class="size-4" />
					Logga ut
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<Button
			type="button"
			variant="outline"
			size="sm"
			class="ml-auto"
			disabled={!canLeave}
			onclick={() =>
				confirm({
					title: 'Lämna mötet?',
					description:
						'Du kommer att lämna mötet. Om du vill komma tillbaka måste en administratör godkänna dig.',
					confirm: { text: 'Lämna möte' },
					onConfirm: () => leaveMeeting(),
				})}
		>
			<DoorOpenIcon class="size-4" />
			Lämna möte
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={!canLeave}
			onclick={() =>
				confirm({
					title: 'Logga ut?',
					description:
						'Du kommer att lämna mötet och loggas ut från ditt konto. Om du vill komma tillbaka måste en administratör godkänna dig.',
					confirm: { text: 'Logga ut' },
					onConfirm: () => signOut(),
				})}
		>
			<LogOutIcon class="size-4" />
			Logga ut
		</Button>
	</nav>
{/if}
