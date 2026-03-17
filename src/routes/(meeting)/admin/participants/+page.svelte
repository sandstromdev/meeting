<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import Button from '$lib/components/ui/button/button.svelte';
	import { confirmAsync } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import { getMeetingContext } from '$lib/context.svelte';
	import { isValidRole, ROLE_LABELS } from '$lib/roles';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	const meeting = getMeetingContext();

	const participantsResult = meeting.adminQuery(api.admin.users.getParticipants);
	const participants = $derived(participantsResult.data ?? []);

	const present = $derived(participants.filter((p) => p.absentSince === 0));
	const absent = $derived(participants.filter((p) => p.absentSince > 0));

	const intl = new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short' });

	async function handleRoleChange(userId: Id<'meetingParticipants'>, role: string) {
		if (!isValidRole(role)) {
			return;
		}

		const ok = await confirmAsync({
			title: 'Ändra roll',
			description: `Ändra roll till ${ROLE_LABELS[role]}?`,
		});

		if (!ok) {
			return;
		}

		await meeting.adminMutate(api.admin.users.setParticipantRole, { userId, role });
	}

	async function handleToggleAbsent(
		userId: Id<'meetingParticipants'>,
		name: string,
		currentlyAbsent: boolean,
	) {
		const ok = await confirmAsync({
			title: currentlyAbsent ? 'Markera närvarande' : 'Markera frånvarande',
			description: currentlyAbsent
				? `Markera ${name} som närvarande?`
				: `Markera ${name} som frånvarande?`,
		});
		if (!ok) {
			return;
		}

		await meeting.adminMutate(api.admin.users.setParticipantAbsent, {
			userId,
			absent: !currentlyAbsent,
		});
	}

	async function handleRemoveParticipant(userId: Id<'meetingParticipants'>, name: string) {
		const ok = await confirmAsync({
			title: 'Ta bort deltagare',
			description: `Ta bort ${name} från mötet? Detta kan inte ångras.`,
			confirm: { text: 'Ta bort' },
			cancel: { text: 'Avbryt' },
		});
		if (!ok) {
			return;
		}

		await meeting.adminMutate(api.admin.users.removeParticipant, { userId });
	}
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
	<header class="flex items-center gap-4">
		<Button href={resolve('/')} variant="outline" size="icon">
			<ArrowLeftIcon class="size-4" />
		</Button>
		<div>
			<h1 class="text-2xl font-bold">Deltagare</h1>
			<p class="text-sm text-muted-foreground">
				{present.length} närvarande, {absent.length} frånvarande
			</p>
		</div>
	</header>

	<div class="flex flex-col gap-4">
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
					{#each participants as p (p._id)}
						{@const isMe = p._id === meeting.me._id}
						{@const isAbsent = p.absentSince > 0}
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
									{#if p.isInSpeakerQueue}
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
									</NativeSelect.Root>
								{/if}
							</td>
							<td class="px-4 py-3">
								{#if isAbsent}
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
								{#if p.returnRequestedAt > 0}
									<span class="mt-1 block text-xs text-muted-foreground">
										Begärt återkomst {intl.format(new Date(p.returnRequestedAt))}
									</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClickPromise={() => handleToggleAbsent(p._id, p.name, isAbsent)}
									>
										{isAbsent ? 'Markera närvarande' : 'Markera frånvarande'}
									</Button>
									<Button
										variant="destructive"
										size="icon-sm"
										disabled={isMe}
										onClickPromise={() => handleRemoveParticipant(p._id, p.name)}
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
	</div>
</div>
