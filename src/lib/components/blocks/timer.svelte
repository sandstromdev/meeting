<script lang="ts">
	import { formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/context.svelte';
	import { cn } from '$lib/utils';
	import { useInterval } from 'runed';
	import { useNow } from '$lib/now.svelte';
	import { usePageState } from '$lib/page-state.svelte';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const cs = $derived(queue.current);

	const ps = usePageState();
	const now = useNow();

	const shownName = $derived(cs.name ?? '—');
	const shownTime = $derived(
		formatDurationMs(cs.startTime != null ? now.since(cs.startTime) : undefined),
	);
</script>

<section
	class={cn(
		'flex justify-between gap-4 rounded-lg border px-4 py-3 text-foreground',

		ps.isProjector && 'flex-col items-stretch',

		!meeting.isCurrentSpeaker &&
			cs.type === 'point_of_order' &&
			'border-blue-800/20 bg-blue-100 text-blue-900 dark:bg-blue-700/10 dark:text-blue-400',

		!meeting.isCurrentSpeaker &&
			cs.type === 'reply' &&
			'border-yellow-800/20 bg-yellow-100 text-yellow-900 dark:bg-yellow-700/10 dark:text-yellow-400',

		!ps.isProjector &&
			meeting.isCurrentSpeaker &&
			'border-green-800/20 bg-green-100 text-green-900 dark:bg-green-700/10 dark:text-green-400',
	)}
>
	<div>
		<h2 class={cn('text-current/80', ps.isProjector && 'text-xl')}>
			{#if cs.type === 'empty'}
				Ingen talare
			{:else if cs.type === 'point_of_order'}
				Ordningsfråga
			{:else if cs.type === 'reply'}
				Replik
			{:else}
				Talare
			{/if}
		</h2>
		<p class={cn('text-lg font-bold', ps.isProjector && 'text-2xl')}>
			{shownName}
			{#if meeting.isCurrentSpeaker && !ps.isProjector}
				(du)
			{/if}
		</p>
	</div>

	<div
		class={cn(
			'flex items-center justify-center rounded-md bg-current/5 px-4 py-2 md:px-8 md:py-4',
			ps.isProjector && 'md:px-12 md:py-8',
		)}
	>
		<p
			class={cn(
				'font-sans text-xl font-semibold tabular-nums md:text-3xl',
				ps.isProjector && 'text-4xl',
			)}
		>
			{shownTime}
		</p>
	</div>
</section>
