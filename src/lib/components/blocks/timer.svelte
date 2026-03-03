<script lang="ts">
	import { formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/context.svelte';
	import { cn } from '$lib/utils';
	import { useInterval } from 'runed';
	import { useNow } from '$lib/now.svelte';
	import { useSearchParams } from '$lib/search-params.svelte';

	interface Props {
		size?: 'default' | 'large';
	}
	let { size = 'default' }: Props = $props();

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;
	const cs = $derived(queue.current);

	const params = useSearchParams();
	const now = useNow();

	const shownName = $derived(cs.name ?? '—');
	const shownTime = $derived(
		formatDurationMs(cs.startTime != null ? now.since(cs.startTime) : undefined),
	);
</script>

<section
	class={cn(
		'flex justify-between gap-4 rounded-lg border px-4 py-3 text-foreground md:flex-col md:items-stretch',

		!meeting.isCurrentSpeaker &&
			cs.type === 'point_of_order' &&
			'border-blue-800/20 bg-blue-100 text-blue-900',

		!meeting.isCurrentSpeaker &&
			cs.type === 'reply' &&
			'border-yellow-800/20 bg-yellow-100 text-yellow-900',

		params.view !== 'projector' &&
			meeting.isCurrentSpeaker &&
			'border-green-800/20 bg-green-100 text-green-900',
	)}
>
	<div>
		<h2 class={cn('text-current/80', size === 'large' && 'text-xl')}>
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
		<p class={cn('text-lg font-bold', size === 'large' && 'text-2xl')}>
			{shownName}
			{#if meeting.isCurrentSpeaker && params.view !== 'projector'}
				(du)
			{/if}
		</p>
	</div>

	<div
		class={cn(
			'flex items-center justify-center rounded-md bg-current/5 px-4 py-2 md:px-8 md:py-4',
			size === 'large' && 'md:px-12 md:py-8',
		)}
	>
		<p
			class={cn(
				'font-sans font-semibold tabular-nums',
				size === 'default' && 'text-xl md:text-3xl',
				size === 'large' && 'text-5xl',
			)}
		>
			{shownTime}
		</p>
	</div>
</section>
