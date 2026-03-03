<script lang="ts">
	import { setMeetingContext } from '$lib/context.svelte';
	import type { MeetingData } from '$lib/context.svelte';
	import type { WithChildren } from 'bits-ui';

	let { data, children }: WithChildren<{ data: MeetingData }> = $props();

	setMeetingContext(() => data);
</script>

{@render children?.()}
