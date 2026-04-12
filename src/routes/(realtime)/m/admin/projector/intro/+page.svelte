<script lang="ts">
	import MeetingInfo from '$lib/components/blocks/meeting-info.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import { qr } from '@svelte-put/qr/svg';
	import SeoHead from '$lib/components/ui/seo-head.svelte';

	const meeting = getMeetingContext();
</script>

<SeoHead
	title={`${meeting.meeting.title} – Intro (projektor)`}
	description="Intro för projektor med möteskod och välkomst."
/>
<main class="mx-auto flex max-w-6xl gap-6 px-8 pt-[10vh]">
	<div class="flex w-full max-w-2xl flex-col gap-6">
		<MeetingInfo />
		{#if meeting.meeting.code}
			<p
				class="flex items-center justify-center gap-4 rounded-lg border px-8 py-6 font-mono text-4xl font-semibold tabular-nums"
			>
				{#each meeting.meeting.code.split('') as digit, idx (idx)}
					<span class="rounded bg-muted px-2 py-1">{digit}</span>
				{/each}
			</p>
		{/if}
		<div class="rounded-lg border px-6 py-4 text-center">
			<div class="text-4xl font-semibold tabular-nums">{meeting.participants}</div>
			<div class="mt-0.5 text-sm text-muted-foreground">Deltagare</div>
		</div>
	</div>
	<div class="flex-1">
		<div class="rounded-lg border p-4">
			<svg use:qr={{ data: meeting.url, shape: 'circle' }} />
			<p class="text-center text-sm text-muted-foreground">
				Skanna QR-koden för att komma till mötet
			</p>
		</div>
	</div>
</main>
