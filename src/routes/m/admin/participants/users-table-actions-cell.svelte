<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import Button from '$lib/components/ui/button/button.svelte';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import BanIcon from '@lucide/svelte/icons/ban';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import { copyText, UseClipboard } from '$lib/hooks/use-clipboard.svelte';
	import { PUBLIC_SITE_URL } from '$env/static/public';
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import type { GenericId } from 'convex/values';

	let {
		_id,
		userId,
		name,
		isBanned,
		isAbsent,
	}: {
		_id: Id<'meetingParticipants'>;
		userId: GenericId<'user'>;
		name: string;
		isBanned: boolean;
		isAbsent: boolean;
	} = $props();

	const meeting = getMeetingContext();
	const isMe = $derived(_id === meeting.me._id);

	function handleToggleAbsent() {
		confirm({
			title: isAbsent ? 'Markera närvarande' : 'Markera frånvarande',
			description: isAbsent
				? `Markera ${name} som närvarande?`
				: `Markera ${name} som frånvarande?`,
			onConfirm: () =>
				meeting.adminMutate(api.admin.users.setParticipantAbsent, {
					userId: _id,
					absent: !isAbsent,
				}),
		});
	}

	function handleRemoveParticipant() {
		confirm({
			title: 'Ta bort deltagare',
			description: `Ta bort ${name} från mötet? Detta kan inte ångras.`,
			confirm: { text: 'Ta bort' },
			cancel: { text: 'Avbryt' },
			onConfirm: () => meeting.adminMutate(api.admin.users.removeParticipant, { userId: _id }),
		});
	}

	function handleToggleBanned() {
		confirm({
			title: isBanned ? 'Häv avstängning' : 'Stäng av deltagare',
			description: isBanned
				? `Vill du tillåta ${name} att ansluta till mötet igen?`
				: `Stäng av ${name} från mötet? De kan inte ansluta igen förrän du häver avstängningen.`,
			confirm: { text: isBanned ? 'Häv avstängning' : 'Avstäng' },
			cancel: { text: 'Avbryt' },
			onConfirm: () =>
				meeting.adminMutate(api.admin.users.setParticipantBanned, {
					userId: _id,
					banned: !isBanned,
				}),
		});
	}

	const convex = useConvexClient();
	async function handleCopyLoginLink() {
		const email = await convex.query(api.admin.users.getParticipantEmail, {
			userId,
			meetingId: meeting.id,
		});

		if (!email) {
			return;
		}

		copyText(`${PUBLIC_SITE_URL}/sign-in?email=${encodeURIComponent(email)}`);
	}
</script>

<div class="flex flex-wrap justify-end gap-2">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button variant="outline" size="icon-sm" {...props}>
					<EllipsisVerticalIcon class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content>
			<DropdownMenu.Item onclick={() => handleCopyLoginLink()}>
				<LinkIcon class="size-4" />
				Kopiera inloggningslänk
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={() => handleToggleAbsent()}>
				<CheckIcon class="size-4" />
				{isAbsent ? 'Markera närvarande' : 'Markera frånvarande'}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => handleToggleBanned()}>
				<BanIcon class="size-4" />
				{isBanned ? 'Häv avstängning' : 'Stäng av från mötet'}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => handleRemoveParticipant()}>
				<Trash2Icon class="size-4" />
				Ta bort deltagare
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
