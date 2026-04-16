<script lang="ts">
	import { api } from '@lsnd/convex/_generated/api';
	import {
		BulkMeetingUsersCsvError,
		parseBulkMeetingUsersCsvToRawRows,
		type BulkImportRawRow,
	} from '$lib/bulkMeetingUsersCsv';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Textarea } from '$lib/components/ui/textarea';
	import { getMeetingContext } from '$lib/context.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { toast } from 'svelte-sonner';
	import { useParticipantsContext } from './context.svelte';
	import Input from '$lib/components/ui/input/input.svelte';

	type PreviewSummary = {
		total: number;
		valid: number;
		invalid: number;
		creates: number;
		existingUsers: number;
	};

	type CommitSummary = {
		total: number;
		succeeded: number;
		failed: number;
		createdUsers: number;
		passwordUpdates: number;
		participantAdds: number;
	};

	type RowCommon = {
		rowNumber: number;
		email: string;
		name: string;
		role: string;
		ok: boolean;
		message: string;
		errors: string[];
	};

	type PreviewImportResult = {
		accessMode: 'open' | 'closed' | 'invite_only';
		limit: number;
		summary: PreviewSummary;
		rows: RowCommon[];
	};

	type CommitImportResult = {
		limit: number;
		summary: CommitSummary;
		rows: RowCommon[];
	};

	const ctx = useParticipantsContext();
	const meeting = getMeetingContext();
	const participantAdminApi = api.meeting.admin.bulkUsers;

	let csvText = $state('');
	let fileName = $state<string | null>(null);
	let importMode = $state<'file' | 'paste'>('file');
	let previewLoading = $state(false);
	let commitLoading = $state(false);
	let previewResult = $state<PreviewImportResult | null>(null);
	let commitResult = $state<CommitImportResult | null>(null);

	$effect(() => {
		if (ctx.bulkImportDialogOpen) {
			reset();
		}
	});

	function reset() {
		csvText = '';
		fileName = null;
		importMode = 'file';
		previewLoading = false;
		commitLoading = false;
		previewResult = null;
		commitResult = null;
	}

	function setCsvText(value: string) {
		csvText = value;
		fileName = null;
		previewResult = null;
		commitResult = null;
	}

	function handleClose() {
		ctx.bulkImportDialogOpen = false;
		reset();
	}

	function onFilePick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		fileName = file.name;
		const reader = new FileReader();
		reader.addEventListener('load', () => {
			setCsvText(String(reader.result ?? ''));
		});
		reader.readAsText(file, 'UTF-8');
	}

	function escapeCsvCell(value: string | number) {
		const s = String(value);
		if (/[",\n\r]/.test(s)) {
			return `"${s.replace(/"/g, '""')}"`;
		}
		return s;
	}

	function failedRowsForReport(): RowCommon[] {
		const rows = commitResult?.rows ?? previewResult?.rows ?? [];
		return rows.filter((r) => !r.ok);
	}

	function parseRowsForImport(): BulkImportRawRow[] {
		const text = csvText.trim();
		return parseBulkMeetingUsersCsvToRawRows(text);
	}

	function toastForBulkCsvError(error: unknown) {
		if (error instanceof BulkMeetingUsersCsvError) {
			switch (error.reason) {
				case 'bulk_user_add_invalid_csv_quotes':
					toast.error('Ogiltig CSV: Ofullständiga citattecken.');
					return;
				case 'bulk_user_add_empty_csv':
					toast.error('CSV-filen innehåller inga rader.');
					return;
				case 'bulk_user_add_missing_columns':
					toast.error(
						`Saknade kolumner: ${error.columns ?? ''}. Krävs: email, name, role (valfritt: password).`,
					);
					return;
				case 'bulk_user_add_missing_rows':
					toast.error('CSV-filen saknar datarader under rubrikraden.');
					return;
				case 'bulk_user_add_row_limit_exceeded':
					toast.error(`Högst ${error.limit ?? 200} rader per import.`);
					return;
				default:
					toast.error('CSV-filen kunde inte läsas.');
					return;
			}
		}
		toast.error('CSV-filen kunde inte läsas.');
	}

	function downloadErrorReport() {
		const failed = failedRowsForReport();
		if (failed.length === 0) {
			return;
		}
		const header = ['Rad', 'E-post', 'Namn', 'Roll', 'Meddelande', 'Fel']
			.map(escapeCsvCell)
			.join(',');
		const lines = failed.map((r) =>
			[r.rowNumber, r.email, r.name, r.role, r.message, r.errors.join('; ')]
				.map(escapeCsvCell)
				.join(','),
		);
		const blob = new Blob([`\uFEFF${header}\n${lines.join('\n')}`], {
			type: 'text/csv;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'massimport-fel.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function runPreview() {
		if (!meeting.id) {
			toast.error('Saknar mötes-ID.');
			return;
		}
		if (csvText.trim().length === 0) {
			toast.warning('Lägg till CSV först.');
			return;
		}
		let rows: BulkImportRawRow[];
		try {
			rows = parseRowsForImport();
		} catch (e) {
			toastForBulkCsvError(e);
			previewResult = null;
			return;
		}
		previewLoading = true;
		commitResult = null;
		try {
			const result = await meeting.convex.action(participantAdminApi.previewImport, {
				meetingId: meeting.id,
				rows,
			});
			previewResult = result;
			toast.success('Förhandsgranskning klar.');
		} catch (e) {
			console.error(e);
			toast.error('Förhandsgranskning misslyckades.');
			previewResult = null;
		} finally {
			previewLoading = false;
		}
	}

	async function runCommit() {
		if (!meeting.id) {
			toast.error('Saknar mötes-ID.');
			return;
		}
		if (csvText.trim().length === 0) {
			toast.warning('Lägg till CSV först.');
			return;
		}
		if (!previewResult) {
			toast.warning('Förhandsgranska importen innan du verkställer.');
			return;
		}
		let rows: BulkImportRawRow[];
		try {
			rows = parseRowsForImport();
		} catch (e) {
			toastForBulkCsvError(e);
			commitResult = null;
			return;
		}
		commitLoading = true;
		try {
			const result = await meeting.convex.action(participantAdminApi.commitImport, {
				meetingId: meeting.id,
				rows,
			});
			commitResult = result;
			const { succeeded, failed } = result.summary;
			if (failed === 0) {
				toast.success(`Import klar: ${succeeded} rader lyckades.`);
			} else {
				toast.warning(`Import klar: ${succeeded} lyckades, ${failed} misslyckades.`);
			}
		} catch (e) {
			console.error(e);
			toast.error('Importen misslyckades.');
			commitResult = null;
		} finally {
			commitLoading = false;
		}
	}
</script>

<Dialog.Root bind:open={ctx.bulkImportDialogOpen}>
	<Dialog.Content class="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Massimport av användare</Dialog.Title>
			<Dialog.Description>
				Ladda upp en CSV-fil eller klistra in CSV-innehåll i UTF-8-format. Första raden ska vara
				rubrikerna `email` och `name`. `role` och `password` kan också skickas med som valfria
				kolumner, och saknad roll blir `participant`. Förhandsgranska och verkställ när resultatet
				ser rätt ut.
			</Dialog.Description>
		</Dialog.Header>

		<Tabs.Root bind:value={importMode} class="gap-3">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="file">Ladda upp fil</Tabs.Trigger>
				<Tabs.Trigger value="paste">Klistra in CSV</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="file">
				<Field.Field class="gap-2">
					<Field.Label for="bulk-csv-file">CSV-fil</Field.Label>
					<Input
						type="file"
						accept=".csv,text/csv"
						onchange={onFilePick}
						disabled={previewLoading || commitLoading}
					/>

					{#if fileName}
						<p class="text-xs text-muted-foreground">Vald fil: {fileName}</p>
					{/if}
				</Field.Field>
			</Tabs.Content>

			<Tabs.Content value="paste">
				<Field.Field class="gap-2">
					<Field.Label for="bulk-csv-text">CSV-innehåll</Field.Label>
					<Textarea
						id="bulk-csv-text"
						rows={8}
						value={csvText}
						oninput={(event) => setCsvText(event.currentTarget.value)}
						placeholder="Klistra in CSV här, inklusive rubrikrad med email och name. role och password är valfria."
						disabled={previewLoading || commitLoading}
					/>
				</Field.Field>
			</Tabs.Content>
		</Tabs.Root>

		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={previewLoading || commitLoading || csvText.trim().length === 0}
				onclick={runPreview}
				loading={previewLoading}
			>
				{previewLoading ? 'Förhandsgranskar…' : 'Förhandsgranska'}
			</Button>
			<Button
				type="button"
				size="sm"
				disabled={commitLoading || previewLoading || !previewResult || csvText.trim().length === 0}
				onclick={runCommit}
				loading={commitLoading}
			>
				{commitLoading ? 'Importerar…' : 'Verkställ import'}
			</Button>
			{#if failedRowsForReport().length > 0}
				<Button type="button" variant="secondary" size="sm" onclick={downloadErrorReport}>
					<DownloadIcon class="mr-1 size-4" />
					Ladda ner felrapport
				</Button>
			{/if}
		</div>

		{#if previewResult}
			<div class="rounded-md border border-border bg-muted/20 p-2 text-sm">
				<p class="font-medium">Förhandsgranskning</p>
				<p class="text-muted-foreground">
					{previewResult.summary.total} rader totalt · {previewResult.summary.valid} giltiga ·
					{previewResult.summary.invalid} ogiltiga · gräns {previewResult.limit}
				</p>
			</div>
		{/if}

		{#if commitResult}
			<div class="rounded-md border border-border bg-muted/20 p-2 text-sm">
				<p class="font-medium">Importresultat</p>
				<p class="text-muted-foreground">
					{commitResult.summary.succeeded} lyckades · {commitResult.summary.failed} misslyckades ·
					{commitResult.summary.createdUsers} nya konton · {commitResult.summary.participantAdds} nya
					deltagare
				</p>
			</div>
		{/if}

		{#if previewResult || commitResult}
			{@const rows = commitResult?.rows ?? previewResult?.rows ?? []}
			<ScrollArea class="h-64 rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-12">#</Table.Head>
							<Table.Head>E-post</Table.Head>
							<Table.Head>Namn</Table.Head>
							<Table.Head>Roll</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Meddelande</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each rows as row (row.rowNumber + row.email)}
							<Table.Row class={row.ok ? '' : 'bg-destructive/5'}>
								<Table.Cell class="tabular-nums">{row.rowNumber}</Table.Cell>
								<Table.Cell class="max-w-[140px] truncate">{row.email}</Table.Cell>
								<Table.Cell class="max-w-[120px] truncate">{row.name}</Table.Cell>
								<Table.Cell>{row.role}</Table.Cell>
								<Table.Cell>{row.ok ? 'OK' : 'Fel'}</Table.Cell>
								<Table.Cell class="max-w-[200px] text-xs">{row.message}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</ScrollArea>
		{/if}

		<Dialog.Footer>
			<Button
				type="button"
				variant="outline"
				onclick={handleClose}
				disabled={previewLoading || commitLoading}
			>
				Stäng
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
