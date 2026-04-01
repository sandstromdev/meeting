<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$convex/_generated/api';
	import * as Alert from '$lib/components/ui/alert';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import { parseDate } from '@internationalized/date';
	import { useConvexClient } from '@mmailaender/convex-svelte';
	import { toast } from 'svelte-sonner';

	const convex = useConvexClient();
	const meetingsApi = api.meeting.platform.meetings;

	let title = $state('');
	let dateStr = $state('');
	let timezone = $state('Europe/Stockholm');
	let location = $state('');
	let description = $state('');
	let submitting = $state(false);
	let lastCreated = $state<{ code: string } | null>(null);

	function resetForm() {
		title = '';
		dateStr = '';
		timezone = 'Europe/Stockholm';
		location = '';
		description = '';
	}

	function startOfDayTimestamp(dateInput: string, tz: string): number {
		const cal = parseDate(dateInput);
		return cal.toDate(tz).getTime();
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		lastCreated = null;
		const trimmedTitle = title.trim();
		const trimmedTz = timezone.trim();
		if (!trimmedTitle || !dateStr || !trimmedTz) {
			toast.error('Fyll i alla obligatoriska fält.');
			return;
		}
		let dateMs: number;
		try {
			dateMs = startOfDayTimestamp(dateStr, trimmedTz);
		} catch {
			toast.error('Ogiltigt datum eller tidszon.');
			return;
		}
		submitting = true;
		try {
			const loc = location.trim();
			const desc = description.trim();
			const result = await convex.mutation(meetingsApi.create, {
				title: trimmedTitle,
				date: dateMs,
				timezone: trimmedTz,
				...(loc ? { location: loc } : {}),
				...(desc ? { description: desc } : {}),
			});
			lastCreated = { code: result.code };
			toast.success('Mötet skapades.');
			resetForm();
		} catch (error) {
			console.error(error);
			toast.error('Kunde inte skapa mötet.');
		} finally {
			submitting = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="gap-0">
		<Card.Title class="text-xl font-semibold">Skapa möte</Card.Title>
	</Card.Header>

	<Card.Content>
		<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
			<div class="flex flex-col gap-1.5">
				<Label for="meeting-title">Titel</Label>
				<Input
					id="meeting-title"
					type="text"
					autocomplete="off"
					required
					bind:value={title}
					placeholder="Till exempel: Årsmöte 2026"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="meeting-date">Datum</Label>
				<Input id="meeting-date" type="date" required bind:value={dateStr} />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="meeting-tz">Tidszon (IANA)</Label>
				<Input
					id="meeting-tz"
					type="text"
					required
					bind:value={timezone}
					placeholder="Europe/Stockholm"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="meeting-location">Plats (valfritt)</Label>
				<Input id="meeting-location" type="text" autocomplete="off" bind:value={location} />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="meeting-desc">Beskrivning (valfritt)</Label>
				<Textarea id="meeting-desc" rows={4} class="min-h-[88px]" bind:value={description} />
			</div>

			<Button type="submit" class="w-fit" disabled={submitting}>
				{submitting ? 'Skapar...' : 'Skapa möte'}
			</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if lastCreated}
	<Alert.Root class="border-green-600/40 bg-green-500/10 text-foreground">
		<Alert.Title>Mötet skapades.</Alert.Title>
		<Alert.Description>
			Kod: <span class="font-mono font-semibold text-foreground">{lastCreated.code}</span>
		</Alert.Description>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<CopyButton text={lastCreated.code} variant="outline" size="default" title="Kopiera kod">
				Kopiera kod
			</CopyButton>
			<Button
				variant="outline"
				href={resolve('/(no-realtime)/m/anslut/[code]', { code: lastCreated.code })}
			>
				Öppna admin
			</Button>
		</div>
	</Alert.Root>
{/if}
