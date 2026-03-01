<script lang="ts">
	import BaseLayout from '$lib/layouts/base-layout.svelte';

	let { data: propsData } = $props();
</script>

<BaseLayout meetingId={propsData.meeting.meeting._id} initialData={propsData?.meeting} />
