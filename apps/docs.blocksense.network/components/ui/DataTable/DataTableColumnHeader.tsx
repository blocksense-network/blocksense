import * as React from 'react';

import { Column } from '@tanstack/react-table';
import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
} from 'lucide-react';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  type: 'string' | 'number';
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  type,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div>{title}</div>;
  }

  return (
    <div
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="cursor-pointer flex items-center"
    >
      <span className="capitalize text-sm font-medium">{title}</span>
      {type === 'number' ? (
        column.getIsSorted() === 'desc' ? (
          <ArrowDown10 className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown01 className="ml-2 h-4 w-4" />
        )
      ) : column.getIsSorted() === 'desc' ? (
        <ArrowDownZA className="ml-2 h-4 w-4" />
      ) : (
        <ArrowDownAZ className="ml-2 h-4 w-4" />
      )}
    </div>
  );
}
