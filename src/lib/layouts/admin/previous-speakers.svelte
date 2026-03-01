<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useQuery } from 'convex-svelte';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;

	const take = 10;
	const previousSpeakerResult = useQuery(api.admin.meeting.getPreviousSpeakers, () => ({
		meetingId: meeting.meeting._id,
		take,
	}));

	const previousSpeakers = $derived(queue.previousSpeakers);

	const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;
	function fmt(t: number) {
		return new Date(t).toLocaleTimeString('sv-SE', timeOpts);
	}
</script>

<Collapsible>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&_svg]:rotate-180"
	>
		<div>
			<h2 class="font-semibold">Tidigare talare</h2>
		</div>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>
	<CollapsibleContent>
		<div class="flex flex-col border-t px-4 py-3">
			{#if previousSpeakers.length === 0}
				<p class="text-sm text-muted-foreground">Ingen har talat ännu.</p>
			{:else}
				<ol class="text-sm">
					{#each previousSpeakers as entry (entry.ordinal)}
						<li class="flex justify-between gap-2 border-b px-3 py-2">
							<p class="truncate font-medium">
								{entry.name}
								{#if entry.userId === meeting.me._id}
									<span class="ml-1 text-xs text-muted-foreground">(du)</span>
								{/if}
								{#if entry.isAbsent}
									<span class="ml-1 text-xs text-muted-foreground">(frånvarande)</span>
								{/if}
							</p>
							{#if entry.sessions && entry.sessions.length > 0}
								<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
									{#each entry.sessions as session, i (session.startTime)}
										{@const duration =
											session.stopTime != null ? session.stopTime - session.startTime : null}
										<li>
											{fmt(session.startTime)}–{session.stopTime != null
												? fmt(session.stopTime)
												: '—'}
											{#if duration != null}
												· {formatDurationMs(duration)}
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ol>

				{#if previousSpeakers.length >= take}
					<div class="flex justify-center p-4">
						<p class="text-sm text-muted-foreground">och fler...</p>
					</div>
				{/if}

				<Button
					variant="outline"
					size="sm"
					class="mt-2 ml-auto"
					onClickPromise={() => queue.clearPreviousSpeakers()}
					disabled={previousSpeakers.length === 0}
				>
					Ta bort alla
				</Button>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
