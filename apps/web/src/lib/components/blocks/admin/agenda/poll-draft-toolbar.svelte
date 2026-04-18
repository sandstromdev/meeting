<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import type { PollDrafts } from '$lib/components/blocks/admin/agenda/agenda-poll-drafts.svelte';

	let {
		index,
		drafts,
	}: {
		index: number;
		drafts: PollDrafts;
	} = $props();
</script>

<div class="grid h-max shrink-0 grid-flow-col grid-rows-2 gap-0.5 text-muted-foreground">
	<Button type="button" variant="ghost" size="icon" onclick={() => drafts.moveUp(index)}>
		<ChevronUpIcon class="size-4" />
	</Button>
	<Button type="button" variant="ghost" size="icon" onclick={() => drafts.moveDown(index)}>
		<ChevronDownIcon class="size-4" />
	</Button>
	<Button
		type="button"
		variant="ghost"
		size="icon"
		class="hover:bg-destructive/10 hover:text-destructive"
		onclick={() =>
			confirm({
				title: 'Ta bort omröstning?',
				description: 'Är du säker på att du vill ta bort denna omröstning?',
				onConfirm: async () => {
					drafts.removePollDraft(index);
				},
			})}
		aria-label="Ta bort omröstning"
	>
		<Trash2Icon class="size-4" />
	</Button>
	<Button type="button" variant="ghost" size="icon" onclick={() => drafts.editPoll(index)}>
		<PencilIcon class="size-4" />
	</Button>
</div>
