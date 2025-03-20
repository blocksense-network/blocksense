'use client';

import { useContext } from 'react';
import { X } from 'lucide-react';

import { Input } from '@blocksense/ui/Input';
import { Button } from '@blocksense/ui/Button';
import { DataTableContext } from './DataTableContext';
import { DataTableFacetedFilter } from './DataTableFacetedFilter';
import { DataTableViewOptions } from './DataTableViewOptions';
import { FilterType } from './DataTable';

interface DataTableToolbarProps {
  filterCellTitle?: string;
}

export function DataTableToolbar({ filterCellTitle }: DataTableToolbarProps) {
  const { searchValue, setSearchValue, facetedFilters, setFacetedFilters } =
    useContext(DataTableContext);

  const isFiltered =
    searchValue.trim().length > 0 ||
    facetedFilters.some(
      (filter: FilterType) => filter.selectedValues.length > 0,
    );

  return (
    <div className="flex flex-row items-center justify-between gap-2">
      {filterCellTitle && (
        <div className="flex flex-1 space-x-2 items-start w-full">
          <Input
            placeholder={`Filter ${filterCellTitle}...`}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="h-8 w-full min-w-[250px] lg:w-[250px] mr-1 lg:mr-2 border-solid border-slate-200 transition-all duration-200"
            type="search"
          />
        </div>
      )}
      {facetedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {facetedFilters.map((facetedFilter: FilterType) => (
            <DataTableFacetedFilter
              key={facetedFilter.name}
              title={facetedFilter.title}
              options={facetedFilter.options}
              selectedValues={facetedFilter.selectedValues}
              setSelectedValuesAction={values =>
                setFacetedFilters(
                  facetedFilters.map((filter: FilterType) =>
                    filter.name === facetedFilter.name
                      ? { ...filter, selectedValues: values }
                      : filter,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
      {isFiltered && (
        <Button
          variant="highlight"
          onClick={() => {
            setSearchValue('');
            setFacetedFilters(
              facetedFilters.map(f => ({ ...f, selectedValues: [] })),
            );
          }}
          className="h-8 p-1"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <div className="ml-auto">
        <DataTableViewOptions />
      </div>
    </div>
  );
}
