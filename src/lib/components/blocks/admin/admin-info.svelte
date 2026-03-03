<script lang="ts">
	import { getMeetingContext } from '$lib/context.svelte';

	const meeting = getMeetingContext();

	const absent = $derived(meeting.meeting.absent ?? 0);
	const present = $derived(meeting.meeting.participants ?? 0);
	const voterRoll = $derived(present - absent);
</script>

<div class="px-4 py-3">
	<dl class="grid grid-cols-3 gap-4 text-center">
		<div>
			<dd class="text-2xl font-semibold tabular-nums">{voterRoll}</dd>
			<dt class="mt-0.5 text-xs text-muted-foreground">Röstlängd</dt>
		</div>
		<div>
			<dd class="text-2xl font-semibold tabular-nums">{present}</dd>
			<dt class="mt-0.5 text-xs text-muted-foreground">Mötesdeltagare</dt>
		</div>
		<div>
			<dd class="text-2xl font-semibold tabular-nums">{absent}</dd>
			<dt class="mt-0.5 text-xs text-muted-foreground">Frånvarande</dt>
		</div>
	</dl>
</div>
