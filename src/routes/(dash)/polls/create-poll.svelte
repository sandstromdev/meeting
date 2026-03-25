<script lang="ts">
	import { api } from '$convex/_generated/api';
	import EditPoll from '$lib/components/ui/edit-poll.svelte';
	import type { PollDraft, StandaloneVisibility } from '$lib/validation';
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import { toast } from 'svelte-sonner';

	const convex = useConvexClient();
	const standaloneAdminApi = api.userPoll.admin;

	async function handleSubmit(payload: {
		draft: PollDraft;
		visibilityMode?: StandaloneVisibility;
	}) {
		const vm = payload.visibilityMode ?? 'public';
		try {
			await convex.mutation(standaloneAdminApi.createPoll, {
				draft: {
					title: payload.draft.title,
					options: payload.draft.options,
					type: payload.draft.type,
					winningCount: payload.draft.winningCount ?? 1,
					majorityRule: payload.draft.majorityRule,
					maxVotesPerVoter: payload.draft.maxVotesPerVoter,
					allowsAbstain: payload.draft.allowsAbstain,
					isResultPublic: payload.draft.isResultPublic,
				},
				visibilityMode: vm,
			});
			toast.success('Omröstningen skapades.');
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte skapa omröstningen.');
		}
	}
</script>

<div class="flex flex-col gap-4">
	<h2 class="text-xl font-semibold">Skapa omröstning</h2>
	<EditPoll
		isStandalone
		title="Omröstningens egenskaper"
		titlePlaceholder="Till exempel: Val av mötesordförande"
		onSubmit={handleSubmit}
		submitLabel="Skapa omröstning"
		submitPendingLabel="Skapar..."
	/>
</div>
