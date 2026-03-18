<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatDuration } from '$lib/duration';
	import { Button } from '$lib/components/ui/button';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useNow } from '$lib/now.svelte';

	const meeting = getMeetingContext();
	const now = useNow();

	let {
		text,
		duration,
		variant,
		approve,
		deny,
	}: {
		text: string;
		duration: number | null;
		variant: 'default' | 'warning' | 'destructive';
		approve: () => Promise<void>;
		deny: () => Promise<void>;
	} = $props();
</script>

<div
	class={cn(
		'flex items-center gap-2 rounded-md border border-current/10 py-2 pr-1 pl-3 text-sm',
		variant === 'default' && 'bg-card text-card-foreground',
		variant === 'warning' && 'bg-yellow-50 text-yellow-800',
		variant === 'destructive' && 'bg-red-50 text-red-800',
	)}
>
	<div>
		<p>{text}</p>
		{#if duration}
			<p class="text-xs text-current/80">
				{formatDuration(now.since(duration))}
			</p>
		{/if}
	</div>
	<div class="ml-auto flex gap-0.5">
		<Button
			variant="ghost"
			size="icon"
			onClickPromise={() => approve()}
			type="button"
			class="hover:bg-current/5"
		>
			<CheckIcon class="size-4 text-green-500" />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			onClickPromise={() => deny()}
			type="button"
			class="hover:bg-current/5"
		>
			<XIcon class="size-4 text-red-500" />
		</Button>
	</div>
</div>
