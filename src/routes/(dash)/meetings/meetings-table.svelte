<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { Badge } from '$lib/components/ui/badge';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		createSvelteTable,
		FlexRender,
		renderComponent,
		renderSnippet,
		runUpdater,
	} from '$lib/components/ui/data-table';
	import * as Table from '$lib/components/ui/table';
	import { STATUS_LABELS, STATUS_VARIANTS, type MeetingStatus } from '$lib/meeting-status';
	import type { UseQueryReturn } from '@mmailaender/convex-svelte';
	import {
		createColumnHelper,
		getCoreRowModel,
		type RowSelectionState,
	} from '@tanstack/table-core';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { CopyButton } from '$lib/components/ui/copy-button';
	import { resolve } from '$app/paths';
	import Loading from '$lib/components/ui/loading.svelte';
	import { cn } from '$lib/utils';

	const meetingsApi = api.meeting.platform.meetings;

	type Meetings = UseQueryReturn<typeof meetingsApi.listForCurrentUser>;
	type MeetingRow = NonNullable<Meetings['data']>[number];

	let { meetings }: { meetings: Meetings } = $props();

	const ch = createColumnHelper<MeetingRow>();

	const columns = [
		ch.display({
			id: 'select',
			header: ({ table }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all',
				}),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value) => row.toggleSelected(!!value),
					'aria-label': 'Select row',
				}),
		}),
		ch.accessor('title', {
			header: 'Titel',
			cell: ({ row }) => {
				return renderSnippet(meetingTitle, { title: row.original.title, code: row.original.code });
			},
		}),
		ch.accessor('date', {
			header: 'Datum',
			cell: ({ row }) => {
				return renderSnippet(meetingDate, { date: row.original.date });
			},
		}),
		ch.accessor('status', {
			header: 'Status',
			cell: ({ row }) => {
				return renderSnippet(meetingStatus, { status: row.original.status });
			},
		}),
		ch.display({
			id: 'actions',
			cell: ({ row }) => {
				return renderSnippet(meetingActions, { meeting: row.original });
			},
		}),
	];

	let rowSelection = $state<RowSelectionState>({});

	const table = createSvelteTable({
		get data() {
			return meetings.data ?? [];
		},
		state: {
			get rowSelection() {
				return rowSelection;
			},
		},
		columns,
		getRowId: (row) => row._id,
		getCoreRowModel: getCoreRowModel(),
		onRowSelectionChange: (updater) => {
			rowSelection = runUpdater(updater, rowSelection);
		},
	});
</script>

{#snippet meetingTitle({ title, code }: { title: string; code: string })}
	<div><a href={resolve(`/m/anslut/${code}`)} class="hover:underline">{title}</a></div>
{/snippet}

{#snippet meetingStatus({ status }: { status: MeetingStatus })}
	<Badge variant={STATUS_VARIANTS[status]}>
		{STATUS_LABELS[status]}
	</Badge>
{/snippet}

{#snippet meetingDate({ date }: { date: number })}
	<div>
		{new Date(date).toLocaleDateString('sv-SE')}
	</div>
{/snippet}

{#snippet meetingActions({ meeting }: { meeting: MeetingRow })}
	<div class="flex w-max gap-2">
		{#if meeting.status !== 'archived'}
			<Button variant="outline" size="sm" href={`/m/anslut/${meeting.code}`}>
				<EyeIcon />
				Gå till möte
			</Button>
			<CopyButton text={meeting.code} variant="outline" size="icon-sm" title="Kopiera kod" />
		{/if}
		<!-- <DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="icon-sm" {...props}>
						<EllipsisVerticalIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root> -->
	</div>
{/snippet}

<div class="rounded-md border">
	<Table.Root>
		<Table.Header>
			{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<Table.Row>
					{#each headerGroup.headers as header (header.id)}
						<Table.Head colspan={header.colSpan} class="text-muted-foreground">
							{#if !header.isPlaceholder}
								<FlexRender
									content={header.column.columnDef.header}
									context={header.getContext()}
								/>
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			{/each}
		</Table.Header>
		<Table.Body>
			{#each table.getRowModel().rows as row (row.id)}
				<Table.Row data-state={row.getIsSelected() && 'selected'}>
					{#each row.getVisibleCells() as cell (cell.id)}
						<!-- w-0 forces this cell all the way to the right-->
						<Table.Cell class={cn(cell.column.id === 'actions' && 'w-0')}>
							<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
						</Table.Cell>
					{/each}
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
						<div class="flex items-center justify-center gap-2">
							{#if meetings.isLoading}
								<Loading message="Laddar möten..." />
							{:else}
								Inga möten hittades.
							{/if}
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
</div>
