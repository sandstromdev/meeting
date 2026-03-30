<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import type { ComponentProps } from 'svelte';

	type Props = ComponentProps<typeof EditPoll> & {
		dialogTitle: string;
		dialogDescription: string;
	};

	let { dialogTitle, dialogDescription, poll = $bindable(), ...props }: Props = $props();
</script>

<AlertDialog.Root
	open={poll != null}
	onOpenChange={(open) => {
		if (!open) {
			if (props.onDiscard) {
				props.onDiscard();
			} else {
				poll = null;
			}
		}
	}}
>
	<AlertDialog.Content class="max-h-[min(90vh,720px)] overflow-y-auto">
		<AlertDialog.Header>
			<AlertDialog.Title class="text-lg">{dialogTitle}</AlertDialog.Title>
			<AlertDialog.Description>
				{dialogDescription}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if poll}
			{#key poll?.id}
				<EditPoll {poll} {...props} />
			{/key}
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
