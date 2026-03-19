<script lang="ts">
	let {
		isBanned,
		isAbsent,
		absentSince,
		returnRequestedAt,
	}: {
		isBanned: boolean;
		isAbsent: boolean;
		absentSince: number;
		returnRequestedAt: number;
	} = $props();

	const intl = new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short' });
	function formatTime(ts: number) {
		return intl.format(new Date(ts));
	}
</script>

<div class="space-y-1">
	{#if isBanned}
		<span
			class="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
		>
			Avstängd
		</span>
	{:else if isAbsent}
		<span class="flex flex-wrap items-center gap-1.5">
			<span
				class="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
			>
				Frånvarande
			</span>
			<span class="text-xs text-muted-foreground">
				sedan {formatTime(absentSince)}
			</span>
		</span>
	{:else}
		<span
			class="inline-flex rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
		>
			Närvarande
		</span>
	{/if}
	{#if !isBanned && returnRequestedAt > 0}
		<span class="block text-xs text-muted-foreground">
			Begärt återkomst {formatTime(returnRequestedAt)}
		</span>
	{/if}
</div>
