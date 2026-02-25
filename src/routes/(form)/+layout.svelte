<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="grid h-screen w-screen place-items-center">
	<div class="max-w-sm rounded-md border px-6 py-5">
		{@render children()}
	</div>
</div>
