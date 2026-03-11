<script lang="ts">
	import { api } from '$convex/_generated/api';
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { useQuery } from 'convex-svelte';

	const meeting = getMeetingContext();

	const previousSpeakerResult = useQuery(api.moderator.meeting.getPreviousSpeaker, () => ({
		meetingId: meeting.meeting._id,
	}));

	const ps = $derived(previousSpeakerResult.data);
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
			{#if previousSpeakerResult.isLoading}
				<p class="text-sm text-muted-foreground">Laddar...</p>
			{:else if ps == null}
				<p class="text-sm text-muted-foreground">Ingen har talat ännu.</p>
			{:else}
				<div class="flex justify-between gap-2 border-b px-3 py-2">
					<p class="truncate font-medium">
						{ps.name}
						{#if ps.userId === meeting.me._id}
							<span class="ml-1 text-xs text-muted-foreground">(du)</span>
						{/if}
					</p>
				</div>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
