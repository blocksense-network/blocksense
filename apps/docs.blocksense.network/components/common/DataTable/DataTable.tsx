'use client';

import { useContext } from 'react';
import { useRouter } from 'next/navigation';

import { onLinkClick } from '@/src/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@blocksense/ui/Table';
import { cn } from '@blocksense/ui/utils';

import { DataTableContext, DataTableProvider } from './DataTableContext';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import { DataTableColumnHeader } from './DataTableColumnHeader';
import {
  DataRowType,
  DataTableProps,
  getSortingState,
  cellHaveContent,
  noCellData,
} from './dataTableUtils';

export function DataTable({ ...props }: DataTableProps) {
  return (
    <DataTableProvider
      columns={props.columns}
      data={props.data}
      filterCell={props.filterCell}
    >
      <DataTableContent {...props} />
    </DataTableProvider>
  );
}

function DataTableContent({
  columns,
  filterCell = '',
  hasToolbar,
  rowLink,
}: DataTableProps) {
  const router = useRouter();
  const { sorting, setSorting, columnVisibility, paginatedData } =
    useContext(DataTableContext);

  function getRowLink(row: DataRowType) {
    return rowLink && cellHaveContent(row.id) ? `${rowLink}${row.id}` : '';
  }

  return (
    <section className="space-y-4 mt-2">
      {hasToolbar && (
        <DataTableToolbar
          filterCellTitle={columns.find(col => col.id === filterCell)?.title}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(
              col =>
                columnVisibility[col.id] && (
                  <TableHead
                    key={col.id}
                    onClick={() => setSorting(getSortingState(col.id, sorting))}
                    className="cursor-pointer"
                  >
                    {typeof col.header === 'function' ? (
                      col.header({
                        column: col,
                      })
                    ) : (
                      <DataTableColumnHeader title={col.title} />
                    )}
                  </TableHead>
                ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                onClick={e => onLinkClick(e, router, getRowLink(row))}
                onAuxClick={e => onLinkClick(e, router, getRowLink(row), true)}
                className={cn(rowLink && 'cursor-pointer')}
              >
                {columns.map(
                  col =>
                    columnVisibility[col.id] && (
                      <TableCell key={col.id} className="px-2 py-2.5">
                        {typeof col.cell === 'function'
                          ? col.cell({ row })
                          : cellHaveContent(row[col.id])
                            ? row[col.id]
                            : noCellData}
                      </TableCell>
                    ),
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination />
    </section>
  );
}
