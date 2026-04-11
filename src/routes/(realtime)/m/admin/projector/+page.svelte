<script lang="ts">
	import { api } from '$convex/_generated/api';
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

	type ApprovedMotion = NonNullable<
		typeof api.meeting.admin.motions.listApprovedForAgendaItem._returnType
	>[number];

	let size = $state(20);
	const INCREMENT = 1;
	function increaseSize() {
		size = Math.min(size + INCREMENT, 40);
	}

	function decreaseSize() {
		size = Math.max(size - INCREMENT, 16);
	}

	const projCtx = getMeetingContext();
	const currentItem = $derived(projCtx.agenda.currentItem);
	const currentAgendaItemId = $derived(projCtx.agenda.currentAgendaItemId ?? null);

	const approvedMotionsResult = projCtx.adminQuery(
		api.meeting.admin.motions.listApprovedForAgendaItem,
		() => (currentAgendaItemId ? { agendaItemId: currentAgendaItemId } : 'skip'),
	);

	const approvedMotions = $derived(approvedMotionsResult.data ?? []);

	const bases = $derived(approvedMotions.filter((m) => !m.amendsMotionId));
	const amendByParent = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<string, ApprovedMotion[]>();
		for (const m of approvedMotions) {
			if (!m.amendsMotionId) {
				continue;
			}
			const k = m.amendsMotionId as string;
			const list = map.get(k) ?? [];
			list.push(m);
			map.set(k, list);
		}
		for (const [, list] of map) {
			list.sort((a, b) => a.createdAt - b.createdAt);
		}
		return map;
	});

	function motionRef(agendaNumber: string, indexOneBased: number) {
		return `${agendaNumber}.${indexOneBased}`;
	}

	const agendaDescription = $derived(currentItem?.description?.trim() ?? '');

	const hasDescription = $derived(agendaDescription.length > 0);
	const hasMotions = $derived(bases.length > 0);
	const hasMainColumn = $derived(hasDescription || hasMotions);
</script>

<SeoHead
	title={`${projCtx.meeting.title} – Projektoryta`}
	description="Projektoryta: aktuell punkt, timer och talarkö."
/>
<main class="mx-auto grid max-w-[80vw] grid-cols-[1fr_auto] gap-4 p-4 lg:py-12">
	<div class="@container flex flex-col gap-4">
		<CurrentAgendaItem />
		<section class="flex grid-cols-3 flex-col gap-8 rounded-lg border bg-card p-4 @4xl:grid">
			{#if hasMainColumn}
				<div class="col-span-2 flex">
					<div class="flex min-w-0 flex-1 flex-col gap-8">
						<div
							style:font-size="{size}px"
							class="prose prose-2xl max-w-none rounded-lg p-8 text-foreground prose-stone dark:prose-invert prose-h1:text-4xl"
						>
							<h1>{currentItem?.title}</h1>

							{#if hasDescription}
								{#await renderMarkdownToHtml(agendaDescription)}
									<Loading />
								{:then h}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via DOMPurify -->
									{@html h}
								{/await}
							{/if}
						</div>

						{#if hasMotions && currentItem}
							<div
								style:font-size="{size}px"
								class="prose prose-2xl max-w-none rounded-lg p-8 text-foreground prose-stone dark:prose-invert"
							>
								<h2 class="!mt-0 !text-[0.85em] font-semibold tracking-tight text-balance">
									Yrkanden
								</h2>
								<ul class="!mt-4 list-none space-y-8 !pl-0">
									{#each bases as m, i (m._id)}
										<li class="rounded-lg border border-border/60 bg-muted/20 p-6">
											<p class="!mt-0 !mb-3 !text-[0.95em] leading-snug font-semibold">
												{motionRef(currentItem.number, i + 1)}
												{m.title}
											</p>
											<div class="prose prose-2xl max-w-none dark:prose-invert">
												{#await renderMarkdownToHtml(m.text)}
													<Loading />
												{:then html}
													<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via DOMPurify -->
													{@html html}
												{/await}
											</div>
											{#if (amendByParent.get(m._id as string) ?? []).length > 0}
												<ul class="!mt-6 !mb-0 space-y-6 border-l-2 border-primary/40 !pl-6">
													{#each amendByParent.get(m._id as string) ?? [] as am (am._id)}
														<li class="!mt-0 list-none">
															<p class="!mt-0 !mb-2 !text-[0.9em] font-medium">{am.title}</p>
															<div class="prose prose-2xl max-w-none dark:prose-invert">
																{#await renderMarkdownToHtml(am.text)}
																	<Loading />
																{:then html}
																	<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via DOMPurify -->
																	{@html html}
																{/await}
															</div>
														</li>
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>

					<div class="mt-8 flex h-max shrink-0 items-start self-start pt-8">
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

					<Separator orientation="vertical" class="ml-4" />
				</div>
				<div class="grid place-items-center p-4">
					<PollView />
				</div>
			{:else}
				<div class="col-span-3 flex justify-center">
					<div class="w-full max-w-md">
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
