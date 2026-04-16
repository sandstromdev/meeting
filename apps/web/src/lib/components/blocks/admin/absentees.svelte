<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from '$lib/components/ui/collapsible';
	import { useNotifications } from '$lib/notifications.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { untrack } from 'svelte';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { api } from '$convex/_generated/api';
	import { formatDuration } from '$lib/duration';
	import { useNow } from '$lib/now.svelte';

	const meeting = getMeetingContext();

	const absenteesResult = useQuery(api.meeting.admin.meeting.getAbsentees, () => ({
		meetingId: meeting.meeting._id,
	}));
	const absentees = $derived(absenteesResult.data ?? []);

	const notifications = useNotifications();
	const now = useNow();

	let lastIds = $state<Id<'meetingParticipants'>[]>([]);

	const delay = 7000;

	$effect(() => {
		if (absentees.length === 0) {
			return;
		}

		const newIds = absentees.map((a) => a._id);

		const diff = untrack(() => newIds.filter((id) => !lastIds.includes(id)));

		if (diff.length > 0) {
			for (const id of diff) {
				const entry = absentees.find((a) => a._id === id);

				if (!entry || Date.now() - entry.absentSince > delay) {
					continue;
				}

				notifications.add(
					{
						title: 'Frånvaro',
						description: `${absentees.find((a) => a._id === id)?.name} har lämnat mötet.`,
						variant: 'default',
					},
					delay,
				);
			}
		}

		untrack(() => (lastIds = newIds));
	});

	const intl = new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short' });
</script>

<Collapsible>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&_svg]:rotate-180"
	>
		<div>
			<h2 class="font-semibold">Frånvarande</h2>
		</div>
		<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
	</CollapsibleTrigger>
	<CollapsibleContent>
		<div class="border-t px-1 py-3">
			{#if absentees.length === 0}
				<p class="px-3 text-sm text-muted-foreground">Inga är frånvarande.</p>
			{:else}
				<ul class="px-3 text-sm">
					{#each absentees as a, idx (idx)}
						<li class=" py-2 font-medium not-last-of-type:border-b">
							<p class="flex items-center justify-between">
								<span class="truncate">{a.name}</span>
								<span class="text-xs text-muted-foreground">
									{intl.format(new Date(a.absentSince))}
								</span>
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
