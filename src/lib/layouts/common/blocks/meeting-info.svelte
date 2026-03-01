<script lang="ts">
	import { formatDuration } from '$lib/duration';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import { useInterval } from 'runed';

	const meeting = getMeetingContext();
	const doc = $derived(meeting.meeting);

	let now = $state(Date.now());

	useInterval(1000, {
		callback: () => (now = Date.now()),
	});

	const dateText = $derived.by(() => {
		const ts = doc.date ?? (doc as { _creationTime?: number })._creationTime;
		if (ts == null) {
			return '—';
		}
		return new Date(ts).toLocaleDateString('sv-SE', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	});

	const timeText = $derived(
		new Date(now).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
	);

	const startTs = $derived(
		doc.startedAt ?? (doc as { _creationTime?: number })._creationTime ?? now,
	);
	const durationMs = $derived(now - startTs);
	const durationText = $derived(formatDuration(durationMs, { hours: true, minutes: true }));
</script>

<section class="flex items-center justify-between rounded-lg border px-4 py-3">
	<div class="space-y-2">
		<h1 class="text-xl font-semibold">{doc.title}</h1>
		<p class="text-sm text-muted-foreground">{dateText}</p>
	</div>
	<div class="text-right">
		<p class="font-sans text-2xl font-semibold tabular-nums">{timeText}</p>
		<p class="text-sm text-muted-foreground">{durationText}</p>
	</div>
</section>
