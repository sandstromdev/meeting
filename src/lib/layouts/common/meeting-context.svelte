<script lang="ts">
	import { setMeetingContext, type MeetingData } from './context.svelte';
	import type { WithChildren } from 'bits-ui';

	const { children, ...contextProps }: WithChildren<MeetingData> = $props();

	setMeetingContext(() => contextProps);
</script>

{@render children?.()}
