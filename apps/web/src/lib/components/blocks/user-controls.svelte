<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '@lsnd-mt/convex/_generated/api';
	import * as auth from '$lib/auth-client';
	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import ComputerIcon from '@lucide/svelte/icons/computer';
	import DoorOpenIcon from '@lucide/svelte/icons/door-open';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import UserIcon from '@lucide/svelte/icons/user';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

	const meeting = getMeetingContext();
	const ps = usePageState();

	const userQuery = useQuery(api.app.me.getCurrentUser);
	const user = $derived(userQuery.data);
	const isTemporaryUser = $derived(user?.email.endsWith('@m.lsnd.se'));

	function leaveMeeting() {
		confirm({
			title: 'Lämna mötet?',
			description:
				'Du kommer att lämna mötet. Om du vill komma tillbaka måste en administratör godkänna dig.',
			confirm: { text: 'Lämna möte' },
			onConfirm: async () => {
				await meeting.mutate(api.meeting.users.attendance.leaveMeeting);

				await auth.leaveMeeting();

				goto(resolve('/m/anslut'));
			},
		});
	}

	async function signOut() {
		confirm({
			title: 'Logga ut?',
			description:
				'Du kommer att lämna mötet och loggas ut från ditt konto. Om du vill komma tillbaka måste en administratör godkänna dig.',
			confirm: { text: 'Logga ut' },
			onConfirm: async () => {
				await meeting.mutate(api.meeting.users.attendance.leaveMeeting);

				await auth.signOut();

				goto(resolve('/sign-in'));
			},
		});
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
			<DropdownMenu.Content align="start" class="w-max">
				{#if user}
					<div class="flex flex-col px-2 py-1.5 text-sm">
						<div class="flex items-center gap-1">
							{user.name}
							{#if meeting.role !== 'participant'}
								<Badge
									variant={meeting.role === 'admin' ? 'destructive' : 'default'}
									class="capitalize">{meeting.role}</Badge
								>
							{/if}
						</div>
						<div class="text-xs text-muted-foreground">
							{user?.email}
						</div>
						{#if isTemporaryUser}
							<Badge class="mt-1" variant="destructive">Temporär användare</Badge>
						{/if}
					</div>

					<DropdownMenu.Item
						onclick={() => {
							if (userPrefersMode.current === 'dark') {
								setMode('light');
							} else if (userPrefersMode.current === 'light') {
								setMode('system');
							} else {
								setMode('dark');
							}
						}}
					>
						{#if userPrefersMode.current === 'dark'}
							<MoonIcon />
							Tema: Mörkt
						{:else if userPrefersMode.current === 'light'}
							<SunIcon />
							Tema: Ljust
						{:else}
							<ComputerIcon />
							Tema: System
						{/if}
					</DropdownMenu.Item>

					<!-- TODO: Add profile link when implemented -->
					{#if false && !isTemporaryUser}
						<DropdownMenu.Link href={resolve('/profile')}>
							<UserIcon class="size-4" />
							Profil
						</DropdownMenu.Link>
					{/if}

					<DropdownMenu.Separator />
					<DropdownMenu.Item onclick={signOut}>
						<LogOutIcon class="size-4" />
						Logga ut
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={leaveMeeting}>
						<DoorOpenIcon class="size-4" />
						Lämna möte
					</DropdownMenu.Item>
				{:else}
					<div class="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
						<LoaderCircleIcon class="size-4 animate-spin" />
						Laddar...
					</div>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={() => goto(resolve('/m/simplified'))}
		>
			<ArrowLeftIcon class="size-4" />
			Problem? Gå till förenklad vy
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="ml-auto"
			disabled={!canLeave}
			onclick={leaveMeeting}
		>
			<DoorOpenIcon class="size-4" />
			Lämna möte
		</Button>
		<Button type="button" variant="outline" size="sm" disabled={!canLeave} onclick={signOut}>
			<LogOutIcon class="size-4" />
			Logga ut
		</Button>
	</nav>
{/if}
