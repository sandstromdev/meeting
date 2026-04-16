<script lang="ts">
	import { api } from '@lsnd/convex/_generated/api';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import type { UserPollDraft } from '$lib/polls';
	import { notifyMutation } from '$lib/admin-toast';

	const convex = useConvexClient();
	const standaloneAdminApi = api.userPoll.admin;

	async function handleSubmit(payload: UserPollDraft) {
		await notifyMutation('Omröstningen skapades.', () =>
			convex.mutation(standaloneAdminApi.createPoll, {
				draft: {
					title: payload.title,
					options: payload.options,
					type: payload.type,
					winningCount: payload.winningCount ?? 1,
					majorityRule: payload.majorityRule,
					maxVotesPerVoter: payload.maxVotesPerVoter,
					allowsAbstain: payload.allowsAbstain,
					isResultPublic: payload.isResultPublic,
					visibilityMode: payload.visibilityMode,
				},
			}),
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
	titlePlaceholder="Till exempel: Val av mötesordförande"
	onSubmit={async (d) => handleSubmit(d as UserPollDraft)}
	submitLabel="Skapa omröstning"
	submitPendingLabel="Skapar..."
/>
<!-- 	</Card.Content>
</Card.Root> -->
