<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import { formatDuration, formatDurationMs } from '$lib/duration';
	import { getMeetingContext } from '$lib/context.svelte';
	import { useNow } from '$lib/now.svelte';
	import { cn } from '$lib/utils';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { notifyMutation } from '$lib/admin-toast';
	import { api } from '$convex/_generated/api';
	import Request from '$lib/components/blocks/admin/request.svelte';

	const meeting = getMeetingContext();
	const now = useNow();

	const returnRequestsResult = useQuery(api.meeting.admin.meeting.getReturnRequests, () => ({
		meetingId: meeting.meeting._id,
	}));

	const returnRequests = $derived(returnRequestsResult.data ?? []);

	const pendingMotionsResult = meeting.adminQuery(api.meeting.admin.motions.listPendingMotions);
	const pendingMotions = $derived(pendingMotionsResult.data ?? []);
</script>

{#if pendingMotions.length > 0}
	<div class="space-y-2 p-4">
		<div class="font-medium">Yrkanden (väntar)</div>
		<div class="space-y-3">
			{#each pendingMotions as motion (motion._id)}
				<div
					class="rounded-md border border-yellow-500/30 bg-yellow-50 p-3 text-sm dark:bg-yellow-950/30"
				>
					<p class="font-medium">{motion.title}</p>
					<p class="text-xs text-muted-foreground">{motion.proposerName}</p>
					<p class="mt-2 line-clamp-4 font-mono text-xs whitespace-pre-wrap">{motion.text}</p>
					<div class="mt-2 flex gap-2">
						<Button
							size="sm"
							variant="outline"
							type="button"
							onClickPromise={() =>
								notifyMutation('Yrkande godkänt.', () =>
									meeting.adminMutate(api.meeting.admin.motions.approveMotion, {
										motionId: motion._id,
									}),
								)}
						>
							<CheckIcon class="size-4 text-green-600" />
							Godkänn
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClickPromise={() =>
								notifyMutation('Yrkande avvisat.', () =>
									meeting.adminMutate(api.meeting.admin.motions.rejectMotion, {
										motionId: motion._id,
									}),
								)}
							type="button"
						>
							<XIcon class="size-4 text-red-600" />
							Avvisa
						</Button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<Separator />
{/if}

{#if returnRequests.length > 0}
	<div class="space-y-2 p-4">
		<div class="font-medium">Återkomstbegäran</div>
		<div class="space-y-2">
			{#each returnRequests as req (req.userId)}
				<Request
					text={req.name}
					duration={req.requestedAt}
					variant="warning"
					approve={async () => {
						await notifyMutation('Återkomst godkänd.', () =>
							meeting.adminMutate(api.meeting.admin.meeting.approveReturnRequest, {
								userId: req.userId,
							}),
						);
					}}
					deny={async () => {
						await notifyMutation('Återkomst avvisad.', () =>
							meeting.adminMutate(api.meeting.admin.meeting.denyReturnRequest, {
								userId: req.userId,
							}),
						);
					}}
				/>
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
			<Request
				text="Acceptera streck?"
				duration={null}
				variant="warning"
				approve={async () => {
					await notifyMutation('Streck accepterat.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.acceptBreak),
					);
				}}
				deny={async () => {
					await notifyMutation('Streck avvisat.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearBreak),
					);
				}}
			/>
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() =>
					notifyMutation('Streck avslutat.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearBreak),
					)}
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
			<Request
				text="Acceptera ordningsfråga?"
				duration={null}
				variant="warning"
				approve={async () => {
					await notifyMutation('Ordningsfråga accepterad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.acceptPointOfOrder),
					);
				}}
				deny={async () => {
					await notifyMutation('Ordningsfråga avvisad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearPointOfOrder),
					);
				}}
			/>
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() =>
					notifyMutation('Ordningsfrågan avslutad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearPointOfOrder),
					)}
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
			<Request
				text="Acceptera replik?"
				duration={null}
				variant="warning"
				approve={async () => {
					await notifyMutation('Replik accepterad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.acceptReply),
					);
				}}
				deny={async () => {
					await notifyMutation('Replik avvisad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearReply),
					);
				}}
			/>
		{:else}
			<Button
				variant="outline"
				size="sm"
				onClickPromise={() =>
					notifyMutation('Repliken avslutad.', () =>
						meeting.adminMutate(api.meeting.admin.meeting.clearReply),
					)}
				type="button"
			>
				Avsluta replik
			</Button>
		{/if}
	</div>

	<Separator />
{/if}
<!-- </div> -->
