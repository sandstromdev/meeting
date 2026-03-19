<script lang="ts">
	let {
		name,
		isMe,
		isBanned,
		isInSpeakerQueue,
	}: {
		name: string;
		isMe: boolean;
		isBanned: boolean;
		isInSpeakerQueue: boolean;
	} = $props();
</script>

<div class="flex min-w-0 items-center gap-2 pl-2">
	<span class="truncate">{name}</span>
	{#if isMe}
		<span
			class="inline-flex shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
		>
			du
		</span>
	{/if}
	{#if isBanned}
		<span
			class="inline-flex shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
		>
			avstängd
		</span>
	{/if}
	{#if isInSpeakerQueue && !isBanned}
		<span
			class="inline-flex shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
		>
			i kö
		</span>
	{/if}
</div>
