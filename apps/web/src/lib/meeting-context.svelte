<script lang="ts">
	import { setMeetingContext } from '$lib/context.svelte';
	import type { AttendanceState, MeetingData } from '$lib/context.svelte';
	import type { WithChildren } from 'bits-ui';

	let {
		data,
		attendance,
		children,
	}: WithChildren<{ data: MeetingData; attendance: AttendanceState }> = $props();

	setMeetingContext(
		() => data,
		() => attendance,
	);
</script>

{@render children?.()}
