<script lang="ts">
	import CurrentAgendaItem from '$lib/components/blocks/current-agenda-item.svelte';
	import SpeakerQueue from '$lib/components/blocks/speaker-queue.svelte';
	import Timer from '$lib/components/blocks/timer.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { renderMarkdownToHtml } from '$lib/markdown';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import Loading from '$lib/components/ui/loading.svelte';
	import PollView from './poll-view.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MinusIcon from '@lucide/svelte/icons/minus';

	let size = $state(20);
	const INCREMENT = 1;
	function increaseSize() {
		size = Math.min(size + INCREMENT, 40);
	}

	function decreaseSize() {
		size = Math.max(size - INCREMENT, 16);
	}

	const projCtx = getMeetingContext();
	const agendaDescription = $derived(projCtx.agenda.currentItem?.description?.trim() ?? '');
	const agendaDescriptionHtml = $derived(renderMarkdownToHtml(agendaDescription));
</script>

<SeoHead
	title={`${projCtx.meeting.title} – Projektoryta`}
	description="Projektoryta: aktuell punkt, timer och talarkö."
/>
<main class="mx-auto grid max-w-[80vw] grid-cols-[1fr_auto] gap-4 p-4 lg:py-12">
	<div class="@container flex flex-col gap-4">
		<CurrentAgendaItem />
		<section class="flex grid-cols-3 flex-col gap-8 rounded-lg border bg-card p-4 @4xl:grid">
			{#if agendaDescription}
				<div class="col-span-2 flex">
					{#await agendaDescriptionHtml}
						<Loading />
					{:then h}
						<div
							style:font-size="{size}px"
							class="prose prose-2xl max-w-none rounded-lg p-8 text-foreground prose-stone dark:prose-invert prose-h1:text-4xl"
						>
							<h1>{projCtx.agenda.currentItem?.title}</h1>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via DOMPurify -->
							{@html h}
						</div>

						<div class="mt-8 flex h-max shrink-0 items-center">
							{#if size != 20}
								<div class="mr-2 text-sm text-muted-foreground/30">{size}px</div>
							{/if}
							<Button size="icon-sm" variant="ghost" onclick={decreaseSize}>
								<MinusIcon class="size-4" />
							</Button>
							<Button size="icon-sm" variant="ghost" onclick={increaseSize}>
								<PlusIcon class="size-4" />
							</Button>
						</div>
					{/await}

					<Separator orientation="vertical" class="ml-4" />
				</div>
				<div class="grid place-items-center p-4">
					<PollView />
				</div>
			{:else}
				<div class="col-span-3 flex justify-center">
					<div class="mx-auto w-full max-w-md text-center">
						<PollView />
					</div>
				</div>
			{/if}
		</section>
	</div>

	<div class="flex w-md flex-col rounded-lg border">
		<Timer noBorder />
		<Separator class="mt-1" />
		<SpeakerQueue />
	</div>
</main>
