<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PollResultsDisplay from '$lib/components/poll-results-display.svelte';
	import { Button } from '$lib/components/ui/button';
	import Collapsible from '$lib/components/ui/collapsible/collapsible.svelte';
	import CollapsibleContent from '$lib/components/ui/collapsible/collapsible-content.svelte';
	import CollapsibleTrigger from '$lib/components/ui/collapsible/collapsible-trigger.svelte';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import * as Field from '$lib/components/ui/field';
	import SeoHead from '$lib/components/ui/seo-head.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { qr } from '@svelte-put/qr/svg';
	import { useInterval } from 'runed';
	import { getPollInfoPage } from './data.remote';
	import type { PageData } from './$types';
	import { PUBLIC_SITE_URL } from '$env/static/public';

	let { data } = $props();

	const code = $derived(page.params.code ?? '');

	let httpPollEnabled = $state(true);
	let info = $derived(data.info);
	let lastHttpPollAt = $state.raw(0);

	const HTTP_POLL_HEARTBEAT_MS = 500;
	const HTTP_POLL_INTERVAL_MS = 10_000;
	const HTTP_POLL_INTERVAL_MS_OPEN = 2_000;
	const HTTP_POLL_INTERVAL_MS_OPEN_WITH_LIVE_VOTE_COUNTS = 2_000;

	$effect(() => {
		void data.info;
		info = data.info;
		lastHttpPollAt = 0;
	});

	$effect(() => {
		if (httpPollEnabled) {
			lastHttpPollAt = 0;
		}
	});

	const voteUrl = $derived(`${PUBLIC_SITE_URL}/p/${code}`);

	useInterval(HTTP_POLL_HEARTBEAT_MS, {
		callback: async () => {
			if (!httpPollEnabled || !browser || !code) {
				return;
			}

			let desiredIntervalMs = HTTP_POLL_INTERVAL_MS;

			if (info.isOpen) {
				desiredIntervalMs = HTTP_POLL_INTERVAL_MS_OPEN;
			} else if (info.infoPageShowLiveVoteCounts) {
				desiredIntervalMs = HTTP_POLL_INTERVAL_MS_OPEN_WITH_LIVE_VOTE_COUNTS;
			}

			const now = Date.now();
			if (now - lastHttpPollAt < desiredIntervalMs) {
				return;
			}
			lastHttpPollAt = now;

			const result = await getPollInfoPage({ code }).run();
			if (result.ok) {
				info = result.info;
			}
		},
	});
</script>

<SeoHead
	title={`${info.title} – Infosida`}
	description="Kod, länk och QR till omröstningen. Valfria röstsiffror och resultat enligt arrangörens inställningar."
/>

<main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:pt-[10vh] lg:flex-row">
	<div class="flex w-full max-w-2xl flex-col gap-6">
		<section class="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
			<div class="space-y-1">
				<h1 class="text-xl font-semibold">{info.title}</h1>
				<p class="text-sm text-muted-foreground">
					{info.isOpen ? 'Omröstningen är öppen' : 'Omröstningen är stängd'}
					·
					{info.visibilityMode === 'account_required'
						? 'Konto krävs för att rösta'
						: 'Publik röstning'}
				</p>
			</div>
		</section>

		<div class="rounded-lg border px-4 py-6 sm:px-8">
			<div
				class="mx-auto grid w-fit grid-cols-6 place-items-center gap-1 font-mono text-2xl font-semibold tabular-nums sm:grid-cols-8 sm:gap-2 sm:text-3xl"
				role="img"
				aria-label={`Omröstningskod: ${info.code}`}
			>
				{#each info.code.split('') as ch, idx (idx)}
					<span
						aria-hidden="true"
						class="grid size-10 place-items-center rounded-md bg-muted sm:size-12"
					>
						{ch}
					</span>
				{/each}
			</div>
		</div>

		{#if info.isOpen && info.infoPageShowLiveVoteCounts && info.votesCount != null && info.votersCount != null}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="rounded-lg border px-6 py-4 text-center">
					<div class="text-4xl font-semibold tabular-nums">{info.votesCount}</div>
					<div class="mt-0.5 text-sm text-muted-foreground">Antal röster</div>
				</div>
				<div class="rounded-lg border px-6 py-4 text-center">
					<div class="text-4xl font-semibold tabular-nums">{info.votersCount}</div>
					<div class="mt-0.5 text-sm text-muted-foreground">Antal röstande</div>
				</div>
			</div>
		{:else if info.isOpen && info.infoPageShowLiveVoteCounts === false}
			<p class="text-sm text-muted-foreground">
				Arrangören har inte aktiverat visning av röstsiffror under pågående omröstning.
			</p>
		{/if}

		<div class="flex flex-col gap-3 rounded-lg border p-4">
			<p class="text-sm font-medium">Länk att rösta</p>
			<code class="block rounded-md bg-muted px-2 py-2 text-sm break-all">{voteUrl}</code>
			<div class="flex flex-wrap gap-2">
				<CopyButton text={voteUrl} variant="outline" size="sm">Kopiera länk</CopyButton>
				<Button variant="outline" size="sm" href={resolve(`/p/${code}`)}>Öppna röstsidan</Button>
			</div>
		</div>

		{#if !info.isOpen}
			<Collapsible class="rounded-lg border">
				<CollapsibleTrigger
					class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 data-[state=open]:[&>svg]:rotate-180"
				>
					<span class="text-lg font-medium">Resultat</span>
					<ChevronDownIcon class="size-4 shrink-0 transition-transform" />
				</CollapsibleTrigger>
				<CollapsibleContent class="border-t px-4 py-3">
					{#if info.results}
						<PollResultsDisplay
							data={{ results: info.results }}
							resultVisibility={info.resultVisibility}
							size="lg"
						/>
					{:else if info.resultVisibility === 'none'}
						<p class="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
							Resultatet visas inte offentligt för den här omröstningen.
						</p>
					{:else}
						<p class="text-sm text-muted-foreground">Resultat beräknas eller saknas ännu.</p>
					{/if}
				</CollapsibleContent>
			</Collapsible>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-4 lg:max-w-md">
		<div class="rounded-lg border p-4">
			<svg class="mx-auto max-w-full" use:qr={{ data: voteUrl, shape: 'circle' }} />
			<p class="mt-3 text-center text-sm text-muted-foreground">
				Skanna QR-koden för att öppna röstsidan
			</p>
		</div>

		<Field.Field orientation="horizontal" class="rounded-lg border p-4">
			<Switch bind:checked={httpPollEnabled} id="http-poll" />
			<Field.Content>
				<Field.Label for="http-poll" class="font-medium">Automatisk uppdatering</Field.Label>
			</Field.Content>
		</Field.Field>
	</div>
</main>
