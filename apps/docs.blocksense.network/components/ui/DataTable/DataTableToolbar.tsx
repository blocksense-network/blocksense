import * as React from 'react';

import { X } from 'lucide-react';
import { Table } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from '@/components/ui/DataTable/DataTableViewOptions';
import { DataTableFacetedFilter } from '@/components/ui/DataTable/DataTableFacetedFilter';
import { columnTitles } from '@/components/DataFeeds/columns';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterCell?: string;
  data: TData[];
}

export type OptionType = {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export function DataTableToolbar<TData>({
  table,
  filterCell,
  data,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const getUniqueValues = React.useCallback(
    (column: string) => {
      return Array.from(new Set(data.map((d: any) => d[column]))).map(data => ({
        label: data,
        value: data,
      }));
    },
    [data],
  );

  const ids: OptionType[] = React.useMemo(() => getUniqueValues('id'), [data]);
  const dataSources: OptionType[] = React.useMemo(
    () => getUniqueValues('script'),
    [data],
  );

  return (
    <div className="flex items-center justify-between overflow-x-auto gap-2">
      <div className="flex flex-1 items-center space-x-2">
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
        {table.getColumn('id') && (
          <DataTableFacetedFilter
            column={table.getColumn('id')}
            title={columnTitles['id']}
            options={ids}
          />
        )}
        {table.getColumn('script') && (
          <DataTableFacetedFilter
            column={table.getColumn('script')}
            title="Data Source"
            options={dataSources}
          />
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
      <DataTableViewOptions table={table} />
    </div>
  );
}
