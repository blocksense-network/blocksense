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
    <div className="flex flex-col md:flex-row items-center justify-between overflow-x-auto gap-2 px-1 py-2 lg:py-1">
      <div className="flex flex-1 space-x-2 items-start w-full">
        <div className="flex items-center space-x-2 w-full">
          {filterCell && (
            <Input
              placeholder={`Filter ${filterCell}...`}
              value={
                (table.getColumn(filterCell)?.getFilterValue() as string) ?? ''
              }
              onChange={event =>
                table.getColumn(filterCell)?.setFilterValue(event.target.value)
              }
              className={`h-8 w-full min-w-[250px] lg:w-[250px] mr-1 lg:mr-2 border-solid border-slate-200 transition-all duration-200`}
              type="search"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end w-full gap-1 lg:gap-2 mb-2">
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
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <DataTableViewOptions table={table} columnsTitles={columnsTitles} />
      </div>
    </div>
  );
}
