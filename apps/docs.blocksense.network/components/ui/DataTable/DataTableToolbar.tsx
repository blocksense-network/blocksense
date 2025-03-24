'use client';

import { useContext } from 'react';

import { Input } from '@blocksense/ui/Input';
import { Button } from '@blocksense/ui/Button';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

import { DataTableContext } from './DataTableContext';
import { DataTableFacetedFilter } from './DataTableFacetedFilter';
import { DataTableViewOptions } from './DataTableViewOptions';
import { FilterType } from './dataTableUtils';

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
    <section className="flex flex-col gap-2">
      {filterCellTitle && (
        <aside className="flex space-x-2 items-start w-full">
          <Input
            placeholder={`Filter ${filterCellTitle}...`}
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="h-8 w-full min-w-[250px] lg:w-[250px] mr-1 lg:mr-2 border-solid border-neutral-200 transition-all duration-200"
            type="search"
          />
        </aside>
      )}
      <section className="flex flex-wrap gap-2 items-center">
        {facetedFilters.length > 0 && (
          <div className="flex items-center gap-2">
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
            className="mt-0 h-8 p-1 border-neutral-200 dark:border-neutral-600"
          >
            <ImageWrapper
              src="/icons/escape.svg"
              alt="Clear filters"
              className="h-4 w-4 invert"
            />
          </Button>
        )}
        <aside className="ml-auto">
          <DataTableViewOptions />
        </aside>
      </section>
    </section>
  );
}
