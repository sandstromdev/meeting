<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { agendaItemMotionSettings } from '$convex/helpers/agenda';
	import { getMeetingContext } from '$lib/context.svelte';
	import { renderMarkdownToHtml } from '$lib/markdown';
	import { useQuery } from '@mmailaender/convex-svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Loading from '$lib/components/ui/loading.svelte';
	import { toast } from 'svelte-sonner';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';

	type ApprovedRow = NonNullable<
		typeof api.meeting.users.motions.listApprovedForCurrentAgenda._returnType
	>[number];

	const meeting = getMeetingContext();

	const approvedResult = useQuery(api.meeting.users.motions.listApprovedForCurrentAgenda, () => ({
		meetingId: meeting.meeting._id,
	}));

	const myPendingResult = useQuery(api.meeting.users.motions.getMyPendingMotion, () => ({
		meetingId: meeting.meeting._id,
	}));

	const current = $derived(meeting.agenda.currentItem);
	const motionCfg = $derived(
		current
			? agendaItemMotionSettings(current)
			: { allowMotions: false, motionSubmissionMode: 'open' as const },
	);

	const approved = $derived(approvedResult.data ?? []);
	const myPending = $derived(myPendingResult.data);

	const canInteract = $derived(meeting.isOpen && !meeting.me.absentSince && meeting.isParticipant);

	const canSubmitHere = $derived(canInteract && motionCfg.allowMotions && current != null);

	const bases = $derived(approved.filter((m) => !m.amendsMotionId));
	const amendByParent = $derived.by(() => {
		const map = new Map<string, ApprovedRow[]>();
		for (const m of approved) {
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

	let title = $state('');
	let text = $state('');
	let amendsSelect = $state('');

	const amendRequired = $derived(motionCfg.motionSubmissionMode === 'amendments_only');
	const standaloneNeedsTitle = $derived(
		motionCfg.motionSubmissionMode === 'open' && amendsSelect === '',
	);

	$effect(() => {
		void current?.id;
		title = '';
		text = '';
		amendsSelect = '';
	});

	function motionRef(agendaNumber: string, indexOneBased: number) {
		return `${agendaNumber}.${indexOneBased}`;
	}

	async function submitMotion() {
		if (!canSubmitHere) {
			return;
		}
		if (amendRequired && !amendsSelect) {
			toast.warning('Välj vilket yrkande tillägget gäller.');
			return;
		}
		if (standaloneNeedsTitle && !title.trim()) {
			toast.warning('Ange en rubrik för yrkandet.');
			return;
		}
		if (!text.trim()) {
			toast.warning('Skriv yrkandets text.');
			return;
		}

		const r = await meeting.mutate(api.meeting.users.motions.submitMotion, {
			title: title.trim() || undefined,
			text: text.trim(),
			...(amendsSelect ? { amendsMotionId: amendsSelect as Id<'meetingMotions'> } : {}),
		});

		if (!r.ok) {
			if (r.reason === 'already_pending') {
				toast.warning('Du har redan ett yrkande som väntar på behandling.');
			} else {
				toast.error('Kunde inte skicka yrkandet.');
			}
			return;
		}

		toast.success('Yrkande skickat.');
		title = '';
		text = '';
		amendsSelect = '';
	}

	async function withdraw() {
		const ok = await meeting.mutate(api.meeting.users.motions.withdrawMyPendingMotion);
		if (!ok) {
			toast.error('Kunde inte återkalla.');
			return;
		}
		toast.success('Yrkande återkallat.');
	}
</script>

{#if canSubmitHere || approved.length > 0 || myPending}
	<section class="space-y-4 rounded-lg border p-4">
		<h2 class="text-lg font-semibold">Yrkanden</h2>

		{#if myPending}
			<Alert>
				<ScrollTextIcon />
				<AlertTitle>Yrkande väntar på godkännande</AlertTitle>
				<AlertDescription class="space-y-2">
					<p class="font-medium">{myPending.title}</p>
					<Button variant="outline" size="sm" onClickPromise={withdraw} type="button">
						<Undo2Icon class="size-4" />
						Återkalla
					</Button>
				</AlertDescription>
			</Alert>
		{/if}

		{#if approved.length > 0 && current}
			<div class="space-y-3">
				<p class="text-sm font-medium text-muted-foreground">Godkända yrkanden</p>
				<ul class="space-y-4">
					{#each bases as m, i (m._id)}
						<li class="rounded-md border bg-muted/30 p-3">
							<p class="font-medium">
								{motionRef(current.number, i + 1)}
								{m.title}
							</p>
							<div class="prose prose-sm mt-2 max-w-none text-foreground dark:prose-invert">
								{#await renderMarkdownToHtml(m.text)}
									<Loading />
								{:then html}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via DOMPurify -->
									{@html html}
								{/await}
							</div>
							{#if (amendByParent.get(m._id as string) ?? []).length > 0}
								<ul class="mt-3 space-y-2 border-l-2 border-primary/30 pl-3">
									{#each amendByParent.get(m._id as string) ?? [] as am (am._id)}
										<li>
											<p class="text-sm font-medium">{am.title}</p>
											<div class="prose prose-sm mt-1 max-w-none text-foreground dark:prose-invert">
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

		{#if canSubmitHere && !myPending}
			<div class="space-y-3 border-t pt-4">
				<p class="text-sm font-medium">Skicka nytt yrkande</p>
				<p class="text-xs text-muted-foreground">
					Yrkanden gäller endast den aktuella punkten. Texten stödjer markdown.
				</p>

				{#if motionCfg.motionSubmissionMode === 'open'}
					<div class="space-y-1">
						<Label for="motion-amend-parent">Tillägg till befintligt yrkande (valfritt)</Label>
						<select
							id="motion-amend-parent"
							bind:value={amendsSelect}
							class="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
						>
							<option value="">— Nytt fristående yrkande —</option>
							{#each bases as b (b._id)}
								<option value={b._id}>{b.title}</option>
							{/each}
						</select>
					</div>
				{:else}
					<div class="space-y-1">
						<Label for="motion-amend-parent-req">Tillägg till yrkande</Label>
						<select
							id="motion-amend-parent-req"
							bind:value={amendsSelect}
							class="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
						>
							<option value="">— Välj yrkande —</option>
							{#each bases as b (b._id)}
								<option value={b._id}>{b.title}</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if motionCfg.motionSubmissionMode === 'open' || amendsSelect}
					<div class="space-y-1">
						<Label for="motion-title">
							Rubrik
							{#if standaloneNeedsTitle}
								<span class="text-destructive">*</span>
							{:else}
								<span class="text-muted-foreground">(valfritt)</span>
							{/if}
						</Label>
						<Input
							id="motion-title"
							bind:value={title}
							placeholder={amendsSelect
								? 'Valfritt; annars genereras rubrik'
								: 'Rubrik för yrkandet'}
							class="max-w-md"
						/>
					</div>
				{/if}

				<div class="space-y-1">
					<Label for="motion-text">Text (markdown) <span class="text-destructive">*</span></Label>
					<Textarea
						id="motion-text"
						bind:value={text}
						rows={5}
						class="max-w-2xl resize-y font-mono text-sm"
						placeholder="Yrkandets fullständiga text…"
					/>
				</div>

				<Button type="button" onClickPromise={submitMotion}>Skicka yrkande</Button>
			</div>
		{:else if !motionCfg.allowMotions && current}
			<p class="text-sm text-muted-foreground">
				Aktuell punkt tillåter inte nya yrkanden från deltagare.
			</p>
		{/if}
	</section>
{/if}
