import * as React from 'react';

import { X } from 'lucide-react';
import { Table } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from '@/components/ui/DataTable/DataTableViewOptions';
import { DataTableFacetedFilter } from '@/components/ui/DataTable/DataTableFacetedFilter';
import {
  ColumnsTitlesType,
  FilterType,
} from '@/components/ui/DataTable/DataTable';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterCell?: string;
  filters?: FilterType[];
  columnsTitles: ColumnsTitlesType;
}

export function DataTableToolbar<TData>({
  table,
  filterCell,
  filters,
  columnsTitles,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between overflow-x-auto gap-2">
      <div className="flex flex-1 space-x-2 items-end">
        {filterCell && (
          <Input
            placeholder="Filter descriptions..."
            value={
              (table.getColumn(filterCell)?.getFilterValue() as string) ?? ''
            }
            onChange={event =>
              table.getColumn(filterCell)?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px] border-solid border-slate-200"
            type="search"
          />
        )}
        {filters?.map(
          filter =>
            table.getColumn(filter.name) && (
              <DataTableFacetedFilter
                key={filter.name}
                column={table.getColumn(filter.name)}
                title={filter.title}
                options={filter.options}
              />
            ),
        )}
        {isFiltered && (
          <Button
            variant="outline"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3 border-solid border-slate-200"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} columnsTitles={columnsTitles} />
    </div>
  );
}
