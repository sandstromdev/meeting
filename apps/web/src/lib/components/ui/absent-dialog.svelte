<script lang="ts">
	import { api } from '@lsnd/convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { getMeetingContext } from '$lib/context.svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const meeting = getMeetingContext();
</script>

<Dialog.Root open={meeting.isAbsent}>
	<Dialog.Content
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title>Du är markerad som frånvarande</Dialog.Title>
			<Dialog.Description>
				{#if meeting.hasPendingReturnRequest}
					Du har begärt återkomst och väntar på godkännande.
				{:else if meeting.isPollOpen}
					Omröstning pågår. Du kan inte delta i omröstningar medan du är markerad som frånvarande.
				{:else}
					Du kan inte delta i mötet förrän en mötesadmin godkänner din återkomst.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		{#if meeting.hasPendingReturnRequest}
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-center gap-2 text-muted-foreground">
					<LoaderCircle class="size-4 animate-spin" />
					Väntar på godkännande
				</div>
				<Button
					variant="outline"
					size="lg"
					class="w-full"
					onClickPromise={() => meeting.mutate(api.meeting.users.attendance.recallReturnRequest)}
					type="button"
				>
					Återkalla begäran
				</Button>
			</div>
		{:else}
			<Button
				variant="default"
				size="lg"
				class="w-full"
				onClickPromise={() => meeting.mutate(api.meeting.users.attendance.requestReturnToMeeting)}
				type="button"
			>
				Begär återkomst
			</Button>
		{/if}
	</Dialog.Content>
</Dialog.Root>
