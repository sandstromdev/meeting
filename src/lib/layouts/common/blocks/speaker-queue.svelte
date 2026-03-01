<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getMeetingContext } from '$lib/layouts/common/context.svelte';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Alert from '$lib/components/ui/alert';
	import InfoIcon from '@lucide/svelte/icons/info';
	import WarningIcon from '@lucide/svelte/icons/triangle-alert';
	import CheckIcon from '@lucide/svelte/icons/check';

	const meeting = getMeetingContext();
	const queue = meeting.speakerQueue;

	const nextSpeakers = $derived(queue.nextSpeakers);

	const canMoveUp = (displayIndex: number) => displayIndex > 0;
	const canMoveDown = (displayIndex: number) => displayIndex < nextSpeakers.length - 1;
</script>

{#snippet request(
	title: string,
	description: string,
	variant: 'default' | 'warning' | 'destructive',
	accept?: () => void,
	deny?: () => void,
)}
	<Alert.Root {variant} class="">
		{#if variant === 'warning'}
			<WarningIcon class="size-4" />
		{:else if variant === 'default'}
			<InfoIcon class="size-4" />
		{:else if variant === 'destructive'}
			<XIcon class="size-4" />
		{/if}
		<div class="flex items-center justify-between">
			<div>
				<Alert.Title>{title}</Alert.Title>
				<Alert.Description class="text-current/80"><p>{description}</p></Alert.Description>
			</div>

			<div class="flex gap-2">
				{#if accept}
					<Button variant="ghost" size="icon" onclick={accept} class="hover:bg-current/5">
						<CheckIcon class="size-4 text-green-500" />
					</Button>
				{/if}
				{#if deny}
					<Button variant="ghost" size="icon" onclick={deny} class="hover:bg-current/5">
						<XIcon class="size-4 text-red-500" />
					</Button>
				{/if}
			</div>
		</div></Alert.Root
	>
{/snippet}

<section class="hidden space-y-3 rounded-lg border px-4 py-3 lg:block">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Talarkö</h2>
		<p class="text-xs text-muted-foreground">
			{nextSpeakers.length} personer i kön
		</p>
	</div>

	{#if meeting.meeting.break}
		{@render request(
			'Streck i debatten',
			meeting.meeting.break.type === 'requested'
				? `${meeting.meeting.break.by.name} har föreslagit ett streck i debatten.`
				: 'Streck i debatten är accepterat.',
			meeting.meeting.break.type === 'requested' ? 'default' : 'destructive',
			meeting.meeting.break.type === 'accepted' ? undefined : () => queue.acceptBreak(),
			() => queue.clearBreak(),
		)}
	{/if}

	{#if meeting.meeting.pointOfOrder}
		{@render request(
			'Ordningsfråga',
			meeting.meeting.pointOfOrder.type === 'requested'
				? `${meeting.meeting.pointOfOrder.by.name} har begärt ordningsfråga.`
				: 'Ordningsfrågan behandlas.',
			meeting.meeting.pointOfOrder.type === 'requested' ? 'warning' : 'default',
			meeting.meeting.pointOfOrder.type === 'accepted'
				? undefined
				: () => queue.acceptPointOfOrder(),
			() => queue.clearPointOfOrder(),
		)}
	{/if}

	{#if meeting.meeting.reply}
		{@render request(
			'Replik',
			meeting.meeting.reply.type === 'requested'
				? `${meeting.meeting.reply.by.name} har begärt replik.`
				: 'Replik behandlas.',
			meeting.meeting.reply.type === 'requested' ? 'warning' : 'default',
			meeting.meeting.reply.type === 'accepted' ? undefined : () => queue.acceptReply(),
			() => queue.clearReply(),
		)}
	{/if}

	{#if nextSpeakers.length === 0}
		<p class="text-sm text-muted-foreground">Ingen står i kön.</p>
	{:else}
		<ol class="space-y-2 text-sm">
			{#each nextSpeakers as entry, displayIndex (entry.ordinal)}
				<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<span
							class="grid size-5 place-items-center rounded-full bg-muted text-center text-xs font-semibold"
						>
							{displayIndex + 1}
						</span>
						<p class="truncate font-medium">
							{entry.name}
							{#if entry.userId === meeting.me._id}
								<span class="ml-1 text-xs text-muted-foreground">(du)</span>
							{/if}
							{#if entry.isAbsent}
								<span class="ml-1 text-xs text-muted-foreground">(frånvarande)</span>
							{/if}
						</p>
					</div>

					{#if meeting.isAdmin}
						<div class="flex shrink-0 items-center gap-0.5">
							<Button
								variant="ghost"
								size="icon"
								class="size-8"
								disabled={!canMoveUp(displayIndex)}
								onClickPromise={() => queue.moveUp(entry.ordinal)}
								aria-label="Flytta upp"
							>
								<ChevronUpIcon class="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="size-8"
								disabled={!canMoveDown(displayIndex)}
								onClickPromise={() => queue.moveDown(entry.ordinal)}
								aria-label="Flytta ner"
							>
								<ChevronDownIcon class="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClickPromise={() => queue.remove(entry.ordinal)}
								aria-label="Ta bort"
							>
								<XIcon class="size-4" />
							</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>
