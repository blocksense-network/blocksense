'use client';

import React, { useContext } from 'react';

import { Button } from '@blocksense/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@blocksense/ui/DropdownMenu';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

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
          icon={
            <ImageWrapper
              src="/icons/settings.svg"
              alt="Settings"
              className="h-4 w-4 invert"
            />
          }
          className="ml-auto mt-0 bg-white h-8 flex border-solid border-neutral-200 dark:bg-neutral-600"
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
