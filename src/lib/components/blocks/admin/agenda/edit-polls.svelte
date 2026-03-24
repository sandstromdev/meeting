<script lang="ts">
	import AgendaPollDraftToolbar from './poll-draft-toolbar.svelte';
	import { type PollDrafts } from './agenda-poll-drafts.svelte';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import * as Card from '$lib/components/ui/card';

	let {
		drafts,
	}: {
		drafts: PollDrafts;
	} = $props();
</script>

{#if drafts.polls.length > 0}
	<div class="space-y-3">
		{#each drafts.polls as pollDraft, i (i)}
			<div class="relative flex items-center gap-2">
				<AgendaPollDraftToolbar index={i} {drafts} />
				<div class="min-w-0 flex-1">
					{#if drafts.isEditing(i)}
						<EditPoll
							poll={pollDraft}
							showDiscard
							onDiscard={() => drafts.discard()}
							onSubmit={async ({ draft }) => drafts.submit(draft)}
							submitLabel="Spara ändringar"
							submitPendingLabel="Sparar..."
						/>
					{:else}
						<Card.Root class=" gap-1 bg-transparent px-6">
							<Card.Title>Poll: {pollDraft.title}</Card.Title>
							<Card.Description>
								Alternativ: {pollDraft.options.join(', ')} ({pollDraft.options.length} st)
							</Card.Description>
						</Card.Root>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
