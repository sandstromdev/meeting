<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import * as Table from '$lib/components/ui/table';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { getMeetingContext } from '$lib/context.svelte';
	import type { FunctionReference } from 'convex/server';
	import { useParticipantsContext } from './context.svelte';
	import { toast } from 'svelte-sonner';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import {
		BulkMeetingUsersCsvError,
		parseBulkMeetingUsersCsvToRawRows,
		type BulkImportRawRow,
	} from '$lib/bulkMeetingUsersCsv';

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
	const participantAdminApi = api as typeof api & {
		meeting: {
			admin: {
				bulkUsers: {
					previewImport: FunctionReference<
						'action',
						'public',
						{ meetingId: Id<'meetings'>; rows: BulkImportRawRow[] },
						PreviewImportResult
					>;
					commitImport: FunctionReference<
						'action',
						'public',
						{ meetingId: Id<'meetings'>; rows: BulkImportRawRow[] },
						CommitImportResult
					>;
				};
			};
		};
	};

	let csvText = $state('');
	let fileName = $state<string | null>(null);
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
		previewLoading = false;
		commitLoading = false;
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
		reader.onload = () => {
			csvText = String(reader.result ?? '');
			previewResult = null;
			commitResult = null;
		};
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
			toast.warning('Välj en CSV-fil först.');
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
			const result = await meeting.convex.action(
				participantAdminApi.meeting.admin.bulkUsers.previewImport,
				{
					meetingId: meeting.id,
					rows,
				},
			);
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
			toast.warning('Välj en CSV-fil först.');
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
			const result = await meeting.convex.action(
				participantAdminApi.meeting.admin.bulkUsers.commitImport,
				{
					meetingId: meeting.id,
					rows,
				},
			);
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
	<Dialog.Content class="flex max-h-[90vh] max-w-2xl flex-col gap-4">
		<Dialog.Header>
			<Dialog.Title>Massimport av användare</Dialog.Title>
			<Dialog.Description>
				Ladda upp en CSV-fil (UTF-8). Förhandsgranska och verkställ när resultatet ser rätt ut.
				Endast plattformsadministratörer kan importera.
			</Dialog.Description>
		</Dialog.Header>

		<Field.Field class="gap-2">
			<Field.Label for="bulk-csv-file">CSV-fil</Field.Label>
			<input
				id="bulk-csv-file"
				type="file"
				accept=".csv,text/csv"
				class="text-sm file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2 file:py-1"
				onchange={onFilePick}
				disabled={previewLoading || commitLoading}
			/>
			{#if fileName}
				<p class="text-xs text-muted-foreground">Vald fil: {fileName}</p>
			{/if}
		</Field.Field>

		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={previewLoading || commitLoading || csvText.trim().length === 0}
				onclick={runPreview}
			>
				{previewLoading ? 'Förhandsgranskar…' : 'Förhandsgranska'}
			</Button>
			<Button
				type="button"
				size="sm"
				disabled={commitLoading || previewLoading || !previewResult || csvText.trim().length === 0}
				onclick={runCommit}
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
			<ScrollArea class="max-h-64 rounded-md border">
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
