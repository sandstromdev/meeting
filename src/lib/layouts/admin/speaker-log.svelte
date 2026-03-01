<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { formatDurationMs } from '$lib/duration';
	import { cn } from '$lib/utils';

	const meeting = getMeetingContext();
	const entries = $derived(meeting.speakerLogEntries);
</script>

<Collapsible>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&_svg]:rotate-180"
	>
		<div>
			<h2 class="font-semibold">Talarlogg</h2>
			<p class="text-xs text-muted-foreground">
				{entries.length} st
			</p>
		</div>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>
	<CollapsibleContent>
		<div class="border-t px-4 py-3">
			{#if entries.length === 0}
				<p class="text-sm text-muted-foreground">Inga talare har loggats ännu.</p>
			{:else}
				<ol class="space-y-2 text-sm">
					{#each entries as entry, i (entry.startTime + entry.endTime)}
						<li
							class={cn(
								'flex items-center justify-between gap-2 rounded-md border border-current/20 px-3 py-2',
								entry.type === 'speaker' && 'bg-green-100 text-green-900',
								entry.type === 'point_of_order' && 'bg-blue-100 text-blue-900',
								entry.type === 'reply' && 'bg-yellow-100 text-yellow-900',
							)}
						>
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold">{entry.name}</p>
								<p class="text-xs text-current/80">
									{#if entry.type === 'speaker'}
										Talare
									{:else if entry.type === 'point_of_order'}
										Ordningsfråga
									{:else if entry.type === 'reply'}
										Replik
									{/if}
									· {formatDurationMs(entry.endTime - entry.startTime)} · Klar
									{new Date(entry.endTime).toLocaleTimeString('sv-SE', {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</p>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
