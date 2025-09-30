'use client';

import { useContext } from 'react';

import { Separator } from '@blocksense/docs-ui';
import { Button } from '@blocksense/docs-ui/Button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@blocksense/docs-ui/DropdownMenu';
import { ImageWrapper } from '@blocksense/docs-ui/ImageWrapper';

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
        <Separator className="dropdown-menu__separator my-1" />
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
