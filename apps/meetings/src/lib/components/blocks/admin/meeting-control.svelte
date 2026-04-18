<script lang="ts">
	import { api } from '@lsnd-mt/convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { confirm } from '$lib/components/ui/confirm-dialog/confirm-dialog.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import DatabaseBackupIcon from '@lucide/svelte/icons/database-backup';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SquareIcon from '@lucide/svelte/icons/square';
	import { notifyMutation } from '$lib/admin-toast';
	import { toast } from 'svelte-sonner';

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
		const wasOpen = doc.isOpen;
		await notifyMutation(wasOpen ? 'Mötet stängdes.' : 'Mötet öppnades.', () =>
			meeting.adminMutate(api.meeting.admin.meeting.toggleMeeting),
		);
	}

	async function handleTriggerSnapshot() {
		const result = await meeting.adminMutate(api.meeting.admin.meeting.triggerMeetingSnapshot);
		if (result === undefined) {
			return;
		}
		if (result.kind === 'inserted') {
			toast.success('Ögonblicksbilden sparades.');
		} else if (result.reason === 'unchanged') {
			toast.info('Ingen ny ögonblicksbild — innehållet är oförändrat.');
		} else {
			toast.error('Kunde inte spara ögonblicksbild.');
		}
	}

	function handleResetMeeting() {
		confirm({
			title: 'Återställ mötet',
			description:
				'Återställ mötet? Talarkö och pågående talare kommer att rensas. Dagordning och deltagare behålls.',
			confirm: { text: 'Återställ' },
			onConfirm: () =>
				notifyMutation(
					'Mötet återställdes.',
					() => meeting.adminMutate(api.meeting.admin.meeting.resetMeeting),
					{
						rethrow: true,
					},
				),
		});
	}

	async function handleSaveMeetingData(e: Event) {
		e.preventDefault();
		if (!title.trim()) {
			toast.warning('Ange en titel.');
			return;
		}
		if (code.length !== 6 || !/^[0-9]{6}$/.test(code)) {
			toast.warning('Möteskoden måste vara exakt 6 siffror.');
			return;
		}

		const dateTs = new Date(dateInput).getTime();
		if (Number.isNaN(dateTs)) {
			toast.warning('Ogiltigt datum.');
			return;
		}

		isLoading = true;
		try {
			await notifyMutation(
				'Mötesdata sparades.',
				() =>
					meeting.adminMutate(api.meeting.admin.meeting.updateMeetingData, {
						title: title.trim(),
						code: code.trim(),
						date: dateTs,
					}),
				{ errorMessage: 'Kunde inte spara mötesdata.', rethrow: true },
			);
			editOpen = false;
		} catch {
			// Fel visas redan som toast
		} finally {
			isLoading = false;
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

		{#if meeting.isAdmin}
			<Button onClickPromise={handleTriggerSnapshot} type="button" variant="outline">
				<DatabaseBackupIcon class="size-4" />
				Spara ögonblicksbild
			</Button>
		{/if}

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
