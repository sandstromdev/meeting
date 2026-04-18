<script lang="ts">
	import { api } from '@lsnd-mt/convex/_generated/api';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import { getVoteShare } from '$lib/polls';
	import type { FunctionReturnType } from 'convex/server';

	const meeting = getMeetingContext();
	const ps = usePageState();

	const currentPoll = meeting.query(api.meeting.users.meetingPoll.getCurrentPoll);
	const currentPollCounters = meeting.query(api.meeting.users.meetingPoll.getCurrentPollCounters);

	const poll = $derived(currentPoll.data ?? null);
	const counters = $derived(
		currentPollCounters.data ?? { votersCount: 0, eligibleVoters: 0, votesCount: 0 },
	);

	const pollResults = meeting.query(api.meeting.users.meetingPoll.getPollResultsById, () =>
		poll && !poll.isOpen ? { pollId: poll.id } : 'skip',
	);

	const pollResultsDisplayVisibility = $derived.by(() => {
		if (!poll) {
			return 'none';
		}
		if (
			poll.resultVisibility === 'full' ||
			(!ps.isProjector &&
				meeting.isAdmin &&
				(pollResults.data?.results.optionTotals?.length ?? 0) > 0)
		) {
			return 'full';
		}
		return poll.resultVisibility ?? 'none';
	});

	let open = $derived(!!poll && !meeting.isAbsent);
</script>

{#if poll}
	<div>
		<div class="text-lg font-medium text-muted-foreground">
			{poll.isOpen ? 'Omröstning pågår' : 'Omröstning stängd'}
		</div>
		<div class="text-2xl font-semibold">
			{poll.title}
		</div>
		<div class="space-y-4">
			<div class="space-y-2">
				<Progress class="h-4" value={counters.votersCount} max={counters.eligibleVoters} />
				<div class="flex items-center gap-2">
					<div>{counters.votesCount} röster</div>
					<div class="ml-auto">
						{getVoteShare(counters.votersCount, counters.eligibleVoters)}%
					</div>
				</div>
			</div>
			<PollResultsDisplay
				data={pollResults.data ?? null}
				resultVisibility={pollResultsDisplayVisibility}
				size="lg"
			/>
		</div>
	</div>
{:else}
	<div class="text-lg font-medium text-muted-foreground">Ingen omröstning pågår</div>
{/if}
