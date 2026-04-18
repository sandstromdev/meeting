<script lang="ts">
	import AgendaPollDraftToolbar from './poll-draft-toolbar.svelte';
	import { type PollDrafts } from './agenda-poll-drafts.svelte';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import * as Card from '$lib/components/ui/card';
	import type { EditablePollDraft, MeetingPollDraft } from '$lib/polls';

	let {
		drafts,
	}: {
		drafts: PollDrafts;
	} = $props();

	async function submitAgendaDraft(draft: EditablePollDraft) {
		drafts.submit(draft as MeetingPollDraft);
	}
</script>

{#if drafts.polls.length > 0}
	<div class="space-y-3">
		{#each drafts.polls as pollDraft, i (i)}
			<div class="relative flex items-center gap-2">
				<AgendaPollDraftToolbar index={i} {drafts} />
				<div class="min-w-0 flex-1">
					<Card.Root size="sm" class="">
						<Card.Header>
							<Card.Title>Poll: {pollDraft.title}</Card.Title>
							<Card.Description>
								Alternativ: {pollDraft.options.map((o) => o.title).join(', ')} ({pollDraft.options
									.length}
								st)
							</Card.Description>
						</Card.Header>
						{#if drafts.isEditing(i)}
							<Card.Content>
								<EditPoll
									poll={pollDraft}
									showDiscard
									onDiscard={() => drafts.discard()}
									onSubmit={submitAgendaDraft}
									submitLabel="Spara ändringar"
									submitPendingLabel="Sparar..."
								/>
							</Card.Content>
						{/if}
					</Card.Root>
				</div>
			</div>
		{/each}
	</div>
{/if}
