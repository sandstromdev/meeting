<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import * as NativeSelect from '$lib/components/ui/native-select';
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

	function handleRoleChange(userId: Id<'meetingParticipants'>, role: string) {
		if (!isValidRole(role)) {
			return;
		}

		confirm({
			title: 'Ändra roll',
			description: `Ändra roll till ${ROLE_LABELS[role]}?`,
			onConfirm: () =>
				meeting.adminMutate(api.meeting.admin.users.setParticipantRole, { userId, role }),
		});
	}
</script>

{#if isMe}
	<span class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
		{ROLE_LABELS[role as Role]}
	</span>
{:else}
	<NativeSelect.Root
		value={role}
		onchange={(e) => handleRoleChange(userId, e.currentTarget.value)}
		class="h-8 text-xs"
	>
		<NativeSelect.Option value="admin">Admin</NativeSelect.Option>
		<NativeSelect.Option value="moderator">Moderator</NativeSelect.Option>
		<NativeSelect.Option value="participant">Deltagare</NativeSelect.Option>
		<NativeSelect.Option value="adjuster">Justerare</NativeSelect.Option>
	</NativeSelect.Root>
{/if}
