<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as Select from '$lib/components/ui/select';
	import { getMeetingContext } from '$lib/context.svelte';
	import { isValidRole, ROLE_LABELS, type Role } from '$lib/roles';

	let {
		userId,
		role,
	}: {
		userId: Id<'meetingParticipants'>;
		role: string;
	} = $props();

	const meeting = getMeetingContext();
	const isMe = $derived(userId === meeting.me._id);
	let selectedRole = $derived(role);

	function handleRoleChange(userId: Id<'meetingParticipants'>, nextRole: string) {
		if (!isValidRole(nextRole)) {
			selectedRole = role;
			return;
		}

		const previousRole = role;
		confirm({
			title: 'Ändra roll',
			description: `Ändra roll till ${ROLE_LABELS[nextRole]}?`,
			onConfirm: () =>
				meeting.adminMutate(api.meeting.admin.users.setParticipantRole, { userId, role: nextRole }),
			onCancel: () => {
				selectedRole = previousRole;
			},
		});
	}
</script>

{#if isMe}
	<span class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
		{ROLE_LABELS[role as Role]}
	</span>
{:else}
	<Select.Root
		type="single"
		value={selectedRole}
		onValueChange={(value) => handleRoleChange(userId, value)}
	>
		<Select.Trigger class="h-8 w-[140px] rounded border bg-background px-2 text-xs text-foreground">
			{selectedRole ? ROLE_LABELS[selectedRole as Role] : 'Välj roll'}
		</Select.Trigger>

		<Select.Content>
			<Select.Item value="admin">Admin</Select.Item>
			<Select.Item value="moderator">Moderator</Select.Item>
			<Select.Item value="participant">Deltagare</Select.Item>
			<Select.Item value="adjuster">Justerare</Select.Item>
		</Select.Content>
	</Select.Root>
{/if}
