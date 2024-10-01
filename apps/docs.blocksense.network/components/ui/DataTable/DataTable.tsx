import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useRouter } from 'next/router';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/DataTable/DataTablePagination';
import { DataTableToolbar } from '@/components/ui/DataTable/DataTableToolbar';
import { cn } from '@/lib/utils';

export type OptionType = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type FilterType = {
  name: string;
  title: string;
  options: OptionType[];
};

export type ColumnsTitlesType = { [key: string]: string };

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterCell?: string;
  filters?: FilterType[];
  columnsTitles: ColumnsTitlesType;
  hasToolbar?: boolean;
  invisibleColumns?: string[];
  rowLink?: string;
}

function getUniqueValuesFromColumns(
  column: string,
  data: Object[],
): OptionType[] {
  return Array.from(
    new Set(data.map((d: Object) => (d as { [key: string]: unknown })[column])),
  ).map(data => ({
    label: data as string,
    value: data as string,
  }));
}

export function getFacetedFilters(
  columns: string[],
  data: Object[],
  columnTitles: { [key: string]: string },
): FilterType[] {
  return columns.map(column => ({
    name: column,
    title: columnTitles[column as keyof typeof columnTitles],
    options: getUniqueValuesFromColumns(column, data),
  }));
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterCell,
  filters,
  columnsTitles,
  hasToolbar = true,
  invisibleColumns = [],
  rowLink,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      Object.fromEntries(invisibleColumns.map(column => [column, false])),
    );
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 30,
  });
  const router = useRouter();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
  });

  function getRowLink(row: Row<TData>) {
    return rowLink ? `${rowLink}${row.getValue('id')}` : '';
  }

  function onRowClick(e: React.MouseEvent, row: Row<TData>) {
    e.ctrlKey || e.metaKey
      ? window.open(getRowLink(row))
      : router.push(getRowLink(row));
  }

  function onRowAuxClick(row: Row<TData>) {
    const link = getRowLink(row);
    if (!link) return;
    window.open(link);
  }

  return (
    <div className="space-y-4 mt-2">
      {hasToolbar && (
        <DataTableToolbar
          table={table}
          filterCell={filterCell}
          filters={filters}
          columnsTitles={columnsTitles}
          invisibleColumns={invisibleColumns}
        />
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id} className="pl-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  onClick={e => onRowClick(e, row)}
                  onAuxClick={() => onRowAuxClick(row)}
                  className={cn(rowLink && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="px-2 py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
