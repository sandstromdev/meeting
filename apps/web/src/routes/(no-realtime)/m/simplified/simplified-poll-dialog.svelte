<script lang="ts">
	import PollDialog from '$lib/components/blocks/poll-dialog/poll-dialog.svelte';
	import type { PollResultsDisplayData } from '$lib/components/poll-results-display.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import type { api } from '@lsnd-mt/convex/_generated/api';
	import type { SimplifiedPolling } from './simplified-polling.svelte';

	let { p }: { p: SimplifiedPolling } = $props();

	type CurrentPoll = NonNullable<typeof api.meeting.users.meetingPoll.getCurrentPoll._returnType>;

	const pollForDialog = $derived.by((): CurrentPoll | null => {
		const pl = p.poll;
		if (!pl) {
			return null;
		}
		const idx = p.myPollVoteOptionIndexes;
		return {
			id: pl.id,
			title: pl.title,
			options: pl.options,
			isOpen: pl.isOpen,
			maxVotesPerVoter: pl.maxVotesPerVoter,
			isResultPublic: pl.isResultPublic,
			resultVisibility: pl.resultVisibility,
			type: pl.type,
			hasVoted: idx.length > 0,
			myVoteOptionIndexes: [...idx],
		};
	});

	const counters = $derived(
		p.hotSnapshot?.pollCounters ?? { votersCount: 0, eligibleVoters: 0, votesCount: 0 },
	);

	const pollResultsDisplay = $derived.by((): PollResultsDisplayData | null => {
		const raw = p.hotSnapshot?.pollResults;
		if (!raw) {
			return null;
		}
		return {
			complete: raw.complete,
			results: {
				winners: raw.results.winners,
				optionTotals: raw.results.optionTotals,
				...(raw.results.counts != null ? { counts: raw.results.counts } : {}),
			},
		};
	});

	const resultVisibility = $derived(p.poll?.resultVisibility ?? 'none');

	async function vote(optionIndexes: number[]) {
		const pl = p.poll;
		if (pl) {
			await p.vote(pl.id, optionIndexes);
		}
	}

	async function retractVote() {
		const pl = p.poll;
		if (pl) {
			await p.retractVote(pl.id);
		}
	}
</script>

{#if p.poll}
	<Separator />
	<PollDialog
		poll={pollForDialog}
		{counters}
		pollResults={pollResultsDisplay}
		{resultVisibility}
		isProjector={false}
		isAbsent={!!p.me?.absentSince}
		isAdmin={false}
		currentMeetingPollId={p.poll.id}
		onVote={vote}
		onRetractVote={retractVote}
	/>
{/if}
