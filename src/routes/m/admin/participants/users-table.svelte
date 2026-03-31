<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		FlexRender,
		createSvelteTable,
		renderComponent,
		runUpdater,
	} from '$lib/components/ui/data-table';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import { getMeetingContext } from '$lib/context.svelte';
	import {
		type ColumnFiltersState,
		type PaginationState,
		type SortingState,
		createColumnHelper,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel,
	} from '@tanstack/table-core';
	import { ParticipantsContext, useParticipantsContext } from './context.svelte';
	import UsersTableActionsCell from './users-table-actions-cell.svelte';
	import UsersTableRoleCell from './users-table-role-cell.svelte';
	import UsersTableSortableHeader from './users-table-sortable-header.svelte';
	import UsersTableStatusCell from './users-table-status-cell.svelte';
	import UsersTableUserCell from './users-table-user-cell.svelte';
	import type { GenericId } from 'convex/values';

	const meeting = getMeetingContext();
	const ctx = useParticipantsContext();
	type ParticipantRow = (typeof ctx.participants)[number];

	const ch = createColumnHelper<ParticipantRow>();

	function statusSortRank(p: ParticipantRow) {
		if (p.banned) {
			return 2;
		}
		if (p.absentSince > 0) {
			return 1;
		}
		return 0;
	}

	const columns = [
		ch.accessor('name', {
			header: ({ column }) =>
				renderComponent(UsersTableSortableHeader, {
					label: 'Deltagare',
					onclick: column.getToggleSortingHandler(),
					class: '-ms-1 lg:-ms-1',
				}),
			cell: ({ row }) => {
				const p = row.original;
				const isMe = p._id === meeting.me._id;
				return renderComponent(UsersTableUserCell, {
					name: p.name,
					isMe,
					isBanned: p.banned,
					isInSpeakerQueue: p.isInSpeakerQueue,
				});
			},
			filterFn: (row, _columnId, filterValue) => {
				const q = String(filterValue ?? '')
					.toLowerCase()
					.trim();
				if (!q) {
					return true;
				}
				return row.original.name.toLowerCase().includes(q);
			},
		}),
		ch.display({
			id: 'role',
			header: 'Roll',
			cell: ({ row }) => {
				const p = row.original;
				return renderComponent(UsersTableRoleCell, {
					userId: p._id,
					role: p.role,
				});
			},
		}),
		ch.accessor((row) => statusSortRank(row), {
			id: 'status',
			header: ({ column }) =>
				renderComponent(UsersTableSortableHeader, {
					label: 'Status',
					onclick: column.getToggleSortingHandler(),
				}),
			sortingFn: (rowA, rowB) => {
				const a = rowA.original;
				const b = rowB.original;
				const ra = statusSortRank(a);
				const rb = statusSortRank(b);
				if (ra !== rb) {
					return ra - rb;
				}
				if (ra === 1 && a.absentSince !== b.absentSince) {
					return a.absentSince - b.absentSince;
				}
				return a.name.localeCompare(b.name, 'sv');
			},
			cell: ({ row }) => {
				const p = row.original;
				return renderComponent(UsersTableStatusCell, {
					isBanned: p.banned,
					isAbsent: p.absentSince > 0,
					absentSince: p.absentSince,
					returnRequestedAt: p.returnRequestedAt,
				});
			},
		}),
		ch.display({
			id: 'actions',
			header: '',
			cell: ({ row }) => {
				const p = row.original;
				return renderComponent(UsersTableActionsCell, {
					_id: p._id,
					userId: p.userId as GenericId<'user'>,
					name: p.name,
					isBanned: p.banned,
					isAbsent: p.absentSince > 0,
				});
			},
		}),
	];

	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 15 });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);

	const table = createSvelteTable({
		get data() {
			return ctx.participants;
		},
		columns,
		getRowId: (row) => row._id,
		state: {
			get pagination() {
				return pagination;
			},
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
		},
		onPaginationChange: (updater) => {
			pagination = runUpdater(updater, pagination);
		},
		onSortingChange: (updater) => {
			sorting = runUpdater(updater, sorting);
			pagination = { ...pagination, pageIndex: 0 };
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = runUpdater(updater, columnFilters);
			pagination = { ...pagination, pageIndex: 0 };
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
		<Input
			placeholder="Filtrera på namn..."
			value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
			oninput={(e) => table.getColumn('name')?.setFilterValue(e.currentTarget.value)}
			onchange={(e) => table.getColumn('name')?.setFilterValue(e.currentTarget.value)}
			class="max-w-sm"
		/>
	</div>

	{#if ctx.hasMoreParticipants}
		<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
			Visar de första {ParticipantsContext.QUERY_LIMIT} deltagarna. Fler deltagare finns, men visas inte
			ännu.
		</div>
	{/if}

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
							<Table.Cell>
								<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center text-muted-foreground">
							Inga deltagare hittades.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-muted-foreground">
			{table.getFilteredRowModel().rows.length} deltagare
			{#if table.getPageCount() > 1}
				· Sida {table.getState().pagination.pageIndex + 1} av {table.getPageCount()}
			{/if}
		</p>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				Föregående
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				Nästa
			</Button>
		</div>
	</div>
</div>
