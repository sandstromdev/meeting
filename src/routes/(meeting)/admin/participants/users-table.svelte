<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import Button from '$lib/components/ui/button/button.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import { getMeetingContext } from '$lib/context.svelte';
	import { isValidRole, ROLE_LABELS } from '$lib/roles';
	import BanIcon from '@lucide/svelte/icons/ban';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { FunctionReturnType } from 'convex/server';
	import { useParticipantsContext } from './context.svelte';

	const meeting = getMeetingContext();
	const intl = new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short' });

	const ctx = useParticipantsContext();

	function handleRoleChange(userId: Id<'meetingParticipants'>, role: string) {
		if (!isValidRole(role)) {
			return;
		}

		confirm({
			title: 'Ändra roll',
			description: `Ändra roll till ${ROLE_LABELS[role]}?`,
			onConfirm: () => meeting.adminMutate(api.admin.users.setParticipantRole, { userId, role }),
		});
	}

	function handleToggleAbsent(
		userId: Id<'meetingParticipants'>,
		name: string,
		currentlyAbsent: boolean,
	) {
		confirm({
			title: currentlyAbsent ? 'Markera närvarande' : 'Markera frånvarande',
			description: currentlyAbsent
				? `Markera ${name} som närvarande?`
				: `Markera ${name} som frånvarande?`,
			onConfirm: () =>
				meeting.adminMutate(api.admin.users.setParticipantAbsent, {
					userId,
					absent: !currentlyAbsent,
				}),
		});
	}

	function handleRemoveParticipant(userId: Id<'meetingParticipants'>, name: string) {
		confirm({
			title: 'Ta bort deltagare',
			description: `Ta bort ${name} från mötet? Detta kan inte ångras.`,
			confirm: { text: 'Ta bort' },
			cancel: { text: 'Avbryt' },
			onConfirm: () => meeting.adminMutate(api.admin.users.removeParticipant, { userId }),
		});
	}

	function handleToggleBanned(
		userId: Id<'meetingParticipants'>,
		name: string,
		currentlyBanned: boolean,
	) {
		confirm({
			title: currentlyBanned ? 'Häv avstängning' : 'Stäng av deltagare',
			description: currentlyBanned
				? `Vill du tillåta ${name} att ansluta till mötet igen?`
				: `Stäng av ${name} från mötet? De kan inte ansluta igen förrän du häver avstängningen.`,
			confirm: { text: currentlyBanned ? 'Häv avstängning' : 'Avstäng' },
			cancel: { text: 'Avbryt' },
			onConfirm: () =>
				meeting.adminMutate(api.admin.users.setParticipantBanned, {
					userId,
					banned: !currentlyBanned,
				}),
		});
	}
</script>

<div class="rounded-md border">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b text-left text-muted-foreground">
				<th class="px-4 py-3 font-medium">Namn</th>
				<th class="px-4 py-3 font-medium">Roll</th>
				<th class="px-4 py-3 font-medium">Status</th>
				<th class="px-4 py-3 font-medium"></th>
			</tr>
		</thead>
		<tbody>
			{#each ctx.participants as p (p._id)}
				{@const isMe = p._id === meeting.me._id}
				{@const isAbsent = p.absentSince > 0}
				{@const isBanned = p.banned}
				<tr class="border-b last:border-b-0 hover:bg-muted/50">
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<span class="truncate">{p.name}</span>
							{#if isMe}
								<span
									class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
								>
									du
								</span>
							{/if}
							{#if isBanned}
								<span
									class="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
								>
									avstängd
								</span>
							{/if}
							{#if p.isInSpeakerQueue && !isBanned}
								<span
									class="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
								>
									i kö
								</span>
							{/if}
						</div>
					</td>
					<td class="px-4 py-3">
						{#if isMe}
							<span
								class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
							>
								{ROLE_LABELS[p.role]}
							</span>
						{:else}
							<NativeSelect.Root
								value={p.role}
								onchange={(e) => handleRoleChange(p._id, e.currentTarget.value)}
								class="text-xs"
							>
								<NativeSelect.Option value="admin">Admin</NativeSelect.Option>
								<NativeSelect.Option value="moderator">Moderator</NativeSelect.Option>
								<NativeSelect.Option value="participant">Deltagare</NativeSelect.Option>
								<NativeSelect.Option value="adjuster">Justerare</NativeSelect.Option>
							</NativeSelect.Root>
						{/if}
					</td>
					<td class="px-4 py-3">
						{#if isBanned}
							<span
								class="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
							>
								Avstängd
							</span>
						{:else if isAbsent}
							<span class="flex items-center gap-1.5">
								<span
									class="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
								>
									Frånvarande
								</span>
								<span class="text-xs text-muted-foreground">
									sedan {intl.format(new Date(p.absentSince))}
								</span>
							</span>
						{:else}
							<span
								class="inline-flex rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
							>
								Närvarande
							</span>
						{/if}
						{#if !isBanned && p.returnRequestedAt > 0}
							<span class="mt-1 block text-xs text-muted-foreground">
								Begärt återkomst {intl.format(new Date(p.returnRequestedAt))}
							</span>
						{/if}
					</td>
					<td class="px-4 py-3 text-right">
						<div class="flex justify-end gap-2">
							{#if !isBanned}
								<Button
									variant="outline"
									size="sm"
									onclick={() => handleToggleAbsent(p._id, p.name, !!isAbsent)}
								>
									{isAbsent ? 'Markera närvarande' : 'Markera frånvarande'}
								</Button>
							{/if}
							<Button
								variant={isBanned ? 'outline' : 'secondary'}
								size="icon-sm"
								disabled={isMe}
								title={isBanned ? 'Häv avstängning' : 'Stäng av från mötet'}
								onclick={() => handleToggleBanned(p._id, p.name, !!isBanned)}
							>
								<BanIcon class="size-4" />
							</Button>
							<Button
								variant="destructive"
								size="icon-sm"
								disabled={isMe}
								onclick={() => handleRemoveParticipant(p._id, p.name)}
							>
								<Trash2Icon />
							</Button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="4" class="px-4 py-8 text-center text-muted-foreground">
						Inga deltagare hittades.
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
