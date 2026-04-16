<script lang="ts">
	import { api } from '@lsnd/convex/_generated/api';
	import Request from '$lib/components/blocks/admin/request.svelte';
	import CollapsibleContent from '$lib/components/ui/collapsible/collapsible-content.svelte';
	import CollapsibleTrigger from '$lib/components/ui/collapsible/collapsible-trigger.svelte';
	import Collapsible from '$lib/components/ui/collapsible/collapsible.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	const meeting = getMeetingContext();

	const returnRequestsResult = meeting.adminQuery(api.meeting.admin.meeting.getReturnRequests);

	const returnRequests = $derived(returnRequestsResult.data ?? []);
</script>

{#if returnRequests.length > 0}
	<Collapsible class="rounded-lg border" open>
		<CollapsibleTrigger
			class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
		>
			<span class="font-semibold">Återkomstbegäran</span>
			<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
		</CollapsibleTrigger>
		<CollapsibleContent>
			<ScrollArea class="border-t p-2">
				{#each returnRequests as request (request.userId)}
					<Request
						text={request.name}
						duration={request.requestedAt}
						variant="warning"
						approve={async () => {
							await meeting.adminMutate(api.meeting.admin.meeting.approveReturnRequest, {
								userId: request.userId,
							});
						}}
						deny={async () => {
							await meeting.adminMutate(api.meeting.admin.meeting.denyReturnRequest, {
								userId: request.userId,
							});
						}}
					/>
				{/each}
			</ScrollArea>
		</CollapsibleContent>
	</Collapsible>
{/if}
