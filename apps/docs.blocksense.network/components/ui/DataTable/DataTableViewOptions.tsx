'use client';

import { useContext } from 'react';

import { Button } from '@blocksense/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@blocksense/ui/DropdownMenu';
import { DataTableContext } from './DataTableContext';

export function DataTableViewOptions() {
  const { columnVisibility, setColumnVisibility } =
    useContext(DataTableContext);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto bg-white h-8 flex border-solid border-slate-200 dark:bg-neutral-900"
        >
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[12rem]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.keys(columnVisibility).map(col => (
          <DropdownMenuCheckboxItem
            key={col}
            className="capitalize"
            checked={!!columnVisibility[col]}
            onCheckedChange={(checked: boolean) =>
              setColumnVisibility({ ...columnVisibility, [col]: checked })
            }
          >
            {col}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
