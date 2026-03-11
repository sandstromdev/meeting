<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SquareIcon from '@lucide/svelte/icons/square';

	const meeting = getMeetingContext();
	const doc = $derived(meeting.meeting);

	let editOpen = $state(false);
	let title = $state('');
	let code = $state('');
	let dateInput = $state('');
	let isLoading = $state(false);

	$effect(() => {
		if (editOpen && doc) {
			title = doc.title ?? '';
			code = doc.code ?? '';
			const d = doc.date;
			dateInput =
				d != null ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
		}
	});

	async function handleToggleMeeting() {
		await meeting.adminMutate(api.admin.meeting.toggleMeeting);
	}

	function handleResetMeeting() {
		confirm({
			title: 'Återställ mötet',
			description:
				'Återställ mötet? Talarkö och pågående talare kommer att rensas. Dagordning och deltagare behålls.',
			confirm: { text: 'Återställ' },
			onConfirm: () => meeting.adminMutate(api.admin.meeting.resetMeeting),
		});
	}

	async function handleSaveMeetingData(e: Event) {
		e.preventDefault();
		if (!title.trim()) {
			return;
		}
		if (code.length !== 6 || !/^[0-9]{6}$/.test(code)) {
			return;
		}

		const dateTs = new Date(dateInput).getTime();
		if (Number.isNaN(dateTs)) {
			return;
		}

		isLoading = true;
		const ok = await meeting.adminMutate(api.admin.meeting.updateMeetingData, {
			title: title.trim(),
			code: code.trim(),
			date: dateTs,
		});
		isLoading = false;

		if (ok) {
			editOpen = false;
		}
	}
</script>

<div class="space-y-2 px-4 py-3">
	<h2 class="text-lg font-semibold">Möteskontroll</h2>

	<div class="flex flex-col gap-2">
		<Button
			onClickPromise={handleToggleMeeting}
			type="button"
			variant={doc.isOpen ? 'outline' : 'default'}
		>
			{#if doc.isOpen}
				<SquareIcon class="size-4" />
				Stäng möte
			{:else}
				<PlayIcon class="size-4" />
				Öppna möte
			{/if}
		</Button>

		<Button onclick={handleResetMeeting} type="button" variant="outline">
			<RotateCcwIcon class="size-4" />
			Återställ
		</Button>

		<Dialog.Root bind:open={editOpen}>
			<Dialog.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>
						<PencilIcon class="size-4" />
						Redigera mötesdata
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content>
				<form onsubmit={handleSaveMeetingData} class="flex flex-col gap-4">
					<Dialog.Header>
						<Dialog.Title>Redigera mötesdata</Dialog.Title>
					</Dialog.Header>
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="meeting-title">Titel</Label>
							<Input id="meeting-title" bind:value={title} placeholder="Mötets titel" />
						</div>
						<div class="grid gap-2">
							<Label for="meeting-code">Möteskod (6 siffror)</Label>
							<Input
								id="meeting-code"
								bind:value={code}
								placeholder="123456"
								maxlength={6}
								inputmode="numeric"
								pattern={'[0-9]{6}'}
							/>
						</div>
						<div class="grid gap-2">
							<Label for="meeting-date">Datum</Label>
							<Input id="meeting-date" bind:value={dateInput} type="date" />
						</div>
					</div>
					<Dialog.Footer>
						<Button type="button" variant="outline" onclick={() => (editOpen = false)}>
							Avbryt
						</Button>
						<Button type="submit" loading={isLoading} disabled={!title.trim() || code.length !== 6}>
							Spara
						</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>
</div>
