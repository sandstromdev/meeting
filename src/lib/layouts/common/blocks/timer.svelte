<script lang="ts">
	import { formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import { cn } from '$lib/utils';
	import { useInterval } from 'runed';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const cs = $derived(queue.current);

	let now = $state(Date.now());

	useInterval(1000, {
		callback: () => (now = Date.now()),
	});

	const shownName = $derived(cs.name ?? '—');
	const shownTime = $derived(
		formatDurationMs(cs.startTime != null ? now - cs.startTime : undefined),
	);
</script>

<section
	class={cn(
		'space-y-3 rounded-lg border px-4 py-3 text-foreground',
		meeting.isCurrentSpeaker && 'border-green-800/20 bg-green-100 text-green-900',
	)}
>
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-current/80">
				{#if cs.type === 'empty'}
					Tomt
				{:else if cs.type === 'point_of_order'}
					Ordningsfråga
				{:else if cs.type === 'reply'}
					Replik
				{:else}
					Talare
				{/if}
			</h2>
			<p class="text-lg font-bold">
				{shownName}
				{#if meeting.isCurrentSpeaker}
					(du)
				{/if}
			</p>
		</div>
	</div>

	<div class="flex items-center justify-center rounded-md bg-current/5 py-4">
		<p class="font-sans text-3xl font-semibold tabular-nums">{shownTime}</p>
	</div>
</section>
