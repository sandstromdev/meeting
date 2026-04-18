<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, message, children }: { title?: string; message?: string; children?: Snippet } =
		$props();
</script>

<div class="flex h-dvh w-dvw flex-col items-center gap-4 pt-[20vh]">
	{#if title}
		<h1 class="text-2xl font-bold">{title}</h1>
	{/if}
	{#if message}
		<p class="text-sm text-muted-foreground">{message}</p>
	{/if}
	{@render children?.()}
</div>
