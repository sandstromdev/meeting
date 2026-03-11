<script lang="ts">
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import AdminInfo from '$lib/components/blocks/admin/admin-info.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { usePageState } from '$lib/page-state.svelte';

	const meeting = getMeetingContext();
	const ps = usePageState();
	const queue = meeting.speakerQueue;
	const cs = $derived(queue.current);
</script>

{#if ps.projectorMode === 'intro'}
	<main class="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center gap-6 px-8">
		<div class="flex w-full max-w-2xl flex-col gap-6">
			<MeetingInfo />
			{#if meeting.meeting.code}
				<p
					class="flex items-center justify-center gap-4 rounded-lg border px-8 py-6 font-mono text-4xl font-semibold tabular-nums"
				>
					{#each meeting.meeting.code.split('') as digit, idx (idx)}
						<span class="rounded bg-muted px-2 py-1">{digit}</span>
					{/each}
				</p>
			{/if}
			<div class="rounded-lg border">
				<AdminInfo size="lg" />
			</div>
		</div>
	</main>
{:else}
	<main class="mx-auto grid max-w-6xl grid-cols-5 gap-4">
		<div class="col-span-3 flex flex-col justify-center gap-4">
			<CurrentAgendaItem />
			<Timer />
		</div>

		<div class="col-span-2 flex flex-col rounded-lg border">
			<SpeakerQueue />
		</div>
	</main>
{/if}
