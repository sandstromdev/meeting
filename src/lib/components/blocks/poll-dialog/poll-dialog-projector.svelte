<script lang="ts">
	import { api } from '$convex/_generated/api';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import Progress from '$lib/components/ui/progress/progress.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import { getVoteShare } from '$lib/polls';
	import type { FunctionReturnType } from 'convex/server';

	type Poll = NonNullable<FunctionReturnType<typeof api.users.poll.getCurrentPoll>>;

	type PollCounters = {
		votersCount: number;
		votesCount: number;
		eligibleVoters: number;
	};

	let { poll, counters }: { poll: Poll; counters: PollCounters } = $props();

	const meeting = getMeetingContext();
	const ps = usePageState();

	const pollResults = meeting.query(api.users.poll.getPollResultsById, () =>
		!poll.isOpen ? { pollId: poll.id } : 'skip',
	);

	const showPollDetailedResults = $derived(
		poll.isResultPublic ||
			(!ps.isProjector &&
				meeting.isAdmin &&
				(pollResults.data?.results.optionTotals?.length ?? 0) > 0),
	);

	let open = $derived(!!poll && !meeting.isAbsent);
</script>

<AlertDialog.Root open>
	<AlertDialog.Content class="">
		<AlertDialog.Header>
			<AlertDialog.Title class="block  tracking-tight">
				<div class="text-xl font-medium text-muted-foreground">
					{poll.isOpen ? 'Omröstning pågår' : 'Omröstning stängd'}
				</div>
				<div class="text-3xl font-semibold">
					{poll.title}
				</div>
			</AlertDialog.Title>
		</AlertDialog.Header>
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
				showDetailedResults={showPollDetailedResults}
			/>
		</div>
	</AlertDialog.Content>
</AlertDialog.Root>
