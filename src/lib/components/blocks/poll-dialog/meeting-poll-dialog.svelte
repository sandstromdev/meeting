<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { PollResultsDisplayData } from '$lib/components/poll-results-display.svelte';
	import type { PollResultVisibility } from '$lib/pollResultVisibility';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';
	import PollDialog from './poll-dialog.svelte';
	import Requests from './requests.svelte';

	const meeting = getMeetingContext();
	const ps = usePageState();

	const currentPoll = meeting.query(api.meeting.users.meetingPoll.getCurrentPoll);
	const currentPollCounters = meeting.query(api.meeting.users.meetingPoll.getCurrentPollCounters);

	const poll = $derived(currentPoll.data ?? null);

	const pollResultsQuery = meeting.query(api.meeting.users.meetingPoll.getPollResultsById, () =>
		poll && !poll.isOpen ? { pollId: poll.id } : 'skip',
	);

	const counters = $derived(
		currentPollCounters.data ?? { votersCount: 0, eligibleVoters: 0, votesCount: 0 },
	);

	const resultVisibility = $derived.by((): PollResultVisibility => {
		if (!poll) {
			return 'none';
		}
		if (
			poll.resultVisibility === 'full' ||
			(!ps.isProjector &&
				meeting.isAdmin &&
				(pollResultsQuery.data?.results.optionTotals?.length ?? 0) > 0)
		) {
			return 'full';
		}
		return poll.resultVisibility ?? 'none';
	});

	const currentMeetingPollId = $derived(meeting.meeting.currentPollId);

	const pollResultsDisplay = $derived.by((): PollResultsDisplayData | null => {
		const raw = pollResultsQuery.data;
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

	async function vote(optionIndexes: number[]) {
		const p = currentPoll.data;
		if (p) {
			await meeting.mutate(api.meeting.users.meetingPoll.vote, {
				pollId: p.id,
				optionIndexes,
			});
		}
	}

	async function retractVote() {
		const p = currentPoll.data;
		if (p) {
			await meeting.mutate(api.meeting.users.meetingPoll.retractVote, { pollId: p.id });
		}
	}

	async function closePollAndShowResults() {
		const p = currentPoll.data;
		if (p) {
			await meeting.adminMutate(api.meeting.admin.meetingPoll.closePollAndShowResults, {
				pollId: p.id,
			});
		}
	}

	async function cancelPoll() {
		const p = currentPoll.data;
		if (p) {
			await meeting.adminMutate(api.meeting.admin.meetingPoll.cancelPoll, { pollId: p.id });
		}
	}

	async function clearCurrentPollId() {
		await meeting.adminMutate(api.meeting.admin.meetingPoll.clearCurrentPollId);
	}

	async function openPoll() {
		const p = currentPoll.data;
		if (p) {
			await meeting.adminMutate(api.meeting.admin.meetingPoll.openPoll, { pollId: p.id });
		}
	}
</script>

<PollDialog
	{poll}
	{counters}
	pollResults={pollResultsDisplay}
	{resultVisibility}
	isProjector={ps.isProjector}
	isAbsent={meeting.isAbsent}
	isAdmin={meeting.isAdmin}
	{currentMeetingPollId}
	onVote={vote}
	onRetractVote={retractVote}
	onClosePollAndShowResults={closePollAndShowResults}
	onCancelPoll={cancelPoll}
	onClearCurrentPollId={clearCurrentPollId}
	onOpenPoll={openPoll}
>
	{#snippet adminExtras()}
		<Requests />
	{/snippet}
</PollDialog>
