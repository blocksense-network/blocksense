import * as React from 'react';

import { Settings2 } from 'lucide-react';
import { Table } from '@tanstack/react-table';

import { Button } from '@blocksense/ui/Button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/common/DropdownMenu';
import { ColumnsTitlesType } from '@/components/ui/DataTable/DataTable';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  columnsTitles: ColumnsTitlesType;
  invisibleColumns?: string[];
}

export function DataTableViewOptions<TData>({
  table,
  columnsTitles,
  invisibleColumns,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto bg-white h-8 flex border-solid border-slate-200 dark:bg-neutral-900"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[12rem]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            column =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide(),
          )
          .map(column => {
            if (
              invisibleColumns?.includes(column.id) ||
              !columnsTitles[column.id]
            ) {
              return null;
            }

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={value => column.toggleVisibility(!!value)}
              >
                {columnsTitles[column.id as keyof typeof columnsTitles]}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
