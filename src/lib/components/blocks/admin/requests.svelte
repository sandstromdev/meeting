<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { formatDuration, formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useNow } from '$lib/now.svelte';
	import { cn } from '$lib/utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';

	const meeting = getMeetingContext();
	const now = useNow();

	const returnRequestsResult = useQuery(api.admin.meeting.getReturnRequests, () => ({
		meetingId: meeting.meeting._id,
	}));

	const returnRequests = $derived(returnRequestsResult.data ?? []);
</script>

{#snippet request(
	text: string,
	duration: number | null,
	variant: 'default' | 'warning' | 'destructive',
	approve: () => Promise<void>,
	deny: () => Promise<void>,
)}
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
{/snippet}

{#if returnRequests.length > 0}
	<div class="space-y-2 p-4">
		<div class="font-medium">Återkomstbegäran</div>
		<div class="space-y-2">
			{#each returnRequests as req (req.userId)}
				{@render request(
					req.name,
					req.requestedAt,
					'warning',
					async () => {
						await meeting.adminMutate(api.admin.meeting.approveReturnRequest, {
							userId: req.userId,
						});
					},
					async () => {
						await meeting.adminMutate(api.admin.meeting.denyReturnRequest, {
							userId: req.userId,
						});
					},
				)}
			{/each}
		</div>
	</div>

	<Separator />
{/if}

{#if meeting.meeting.break}
	<div class="space-y-2 p-4">
		<p class="text-sm">
			<strong>{meeting.meeting.break.by.name}</strong> har föreslagit ett streck i debatten.
		</p>

		{#if meeting.meeting.break.type === 'requested'}
			{@render request(
				'Acceptera streck?',
				null,
				'warning',
				async () => {
					await meeting.adminMutate(api.admin.meeting.acceptBreak);
				},
				async () => {
					await meeting.adminMutate(api.admin.meeting.clearBreak);
				},
			)}
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearBreak)}
				type="button"
			>
				Avsluta streck
			</Button>
		{/if}
	</div>

	<Separator />
{/if}

{#if meeting.meeting.pointOfOrder}
	<div class="space-y-2 p-4">
		<p class="text-sm">
			<strong>{meeting.meeting.pointOfOrder.by.name}</strong> har begärt ordningsfråga.
		</p>
		{#if meeting.meeting.pointOfOrder.type === 'requested'}
			{@render request(
				'Acceptera ordningsfråga?',
				null,
				'warning',
				async () => {
					await meeting.adminMutate(api.admin.meeting.acceptPointOfOrder);
				},
				async () => {
					await meeting.adminMutate(api.admin.meeting.clearPointOfOrder);
				},
			)}
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearPointOfOrder)}
				type="button"
			>
				Avsluta ordningsfråga
			</Button>
		{/if}
	</div>

	<Separator />
{/if}

{#if meeting.meeting.reply}
	<div class="space-y-2 p-4">
		<p class="text-sm">
			<strong>{meeting.meeting.reply.by.name}</strong> har begärt replik.
		</p>
		{#if meeting.meeting.reply.type === 'requested'}
			{@render request(
				'Acceptera replik?',
				null,
				'warning',
				async () => {
					await meeting.adminMutate(api.admin.meeting.acceptReply);
				},
				async () => {
					await meeting.adminMutate(api.admin.meeting.clearReply);
				},
			)}
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() => meeting.adminMutate(api.admin.meeting.clearReply)}
				type="button"
			>
				Avsluta replik
			</Button>
		{/if}
	</div>

	<Separator />
{/if}
<!-- </div> -->
