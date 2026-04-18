<script lang="ts">
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import { newStandalonePollDraft, type UserPollDraft } from '$lib/polls';
	import { notifyMutation } from '$lib/admin-toast';
	import { createPoll as createPollRemote } from './dashboard.remote';

	let { onCreated = async () => {} } = $props<{ onCreated?: () => Promise<void> | void }>();

	async function handleSubmit(payload: UserPollDraft) {
		await notifyMutation(
			'Omröstningen skapades.',
			async () => {
				const result = await createPollRemote({
					draft: {
						title: payload.title,
						options: payload.options,
						type: payload.type,
						winningCount: payload.winningCount ?? 1,
						majorityRule: payload.majorityRule,
						maxVotesPerVoter: payload.maxVotesPerVoter,
						allowsAbstain: payload.allowsAbstain,
						resultVisibility: payload.resultVisibility,
						isResultPublic: payload.isResultPublic,
						visibilityMode: payload.visibilityMode,
						infoPageEnabled: payload.infoPageEnabled,
						infoPageShowLiveVoteCounts: payload.infoPageShowLiveVoteCounts,
						code: payload.code,
					},
				});

				if (!result.ok) {
					throw result.error;
				}

				await onCreated();
			},
			{ errorMessage: 'Kunde inte skapa omröstningen.' },
		);
	}
</script>

<!-- <Card.Root class="mx-auto w-full max-w-xl">
	<Card.Header>
		<Card.Title>Skapa omröstning</Card.Title>
	</Card.Header>
	<Card.Content> -->
<EditPoll
	isStandalone
	poll={newStandalonePollDraft()}
	titlePlaceholder="Till exempel: Val av mötesordförande"
	onSubmit={async (d) => handleSubmit(d as UserPollDraft)}
	submitLabel="Skapa omröstning"
	submitPendingLabel="Skapar..."
/>
<!-- 	</Card.Content>
</Card.Root> -->
