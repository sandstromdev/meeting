<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="flex flex-col items-center gap-4 pt-[20vh]">
	{@render children()}
</div>
