import React, { createContext, ReactNode, useEffect, useState } from 'react';

import {
  ColumnDef,
  DataType,
  FilterType,
  SortingType,
  applyFacetedFilters,
  filterDataFromSearch,
  getFacetedFilters,
  sortData,
} from './dataTableUtils';

export interface DataTableState {
  sorting: SortingType;
  setSorting: (sorting: SortingType) => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: (pagination: { pageIndex: number; pageSize: number }) => void;
  columnVisibility: { [key: string]: boolean };
  setColumnVisibility: (visibility: { [key: string]: boolean }) => void;
  facetedFilters: FilterType[];
  setFacetedFilters: (facetedFilters: FilterType[]) => void;
  totalRows: number;
  setTotalRows: (total: number) => void;
  paginatedData: DataType;
}

export const DataTableContext = createContext<DataTableState>(
  {} as DataTableState,
);

interface DataTableProviderProps {
  columns: ColumnDef[];
  data: DataType;
  filterCell?: string;
  children: ReactNode;
}

export function DataTableProvider({
  columns,
  data,
  filterCell = '',
  children,
}: DataTableProviderProps) {
  const [sorting, setSorting] = useState<{
    column: string;
    order: 'asc' | 'desc';
  }>({ column: '', order: 'asc' });
  const [searchValue, setSearchValue] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 30 });
  const [facetedFilters, setFacetedFilters] = useState<FilterType[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columnVisibility, setColumnVisibility] = useState(
    columns.reduce(
      (acc, col) => {
        acc[col.id] = col.invisible ? false : true;
        return acc;
      },
      {} as { [key: string]: boolean },
    ),
  );

  useEffect(() => {
    setFacetedFilters(getFacetedFilters(columns, data));
  }, [columns, data]);

  useEffect(() => {
    setPagination(state => ({ ...state, pageIndex: 0 }));
  }, [searchValue]);

  const filteredData = filterDataFromSearch(data, filterCell, searchValue);
  const facetedFiltersData = applyFacetedFilters(filteredData, facetedFilters);
  const sortedData = sortData(facetedFiltersData, columns, sorting);

  useEffect(() => {
    setTotalRows(sortedData.length);
  }, [sortedData.length]);

  const start = pagination.pageIndex * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginatedData = sortedData.slice(start, end);

  return (
    <DataTableContext.Provider
      value={{
        sorting,
        setSorting,
        searchValue,
        setSearchValue,
        pagination,
        setPagination,
        columnVisibility,
        setColumnVisibility,
        facetedFilters,
        setFacetedFilters,
        totalRows,
        setTotalRows,
        paginatedData,
      }}
    >
      {children}
    </DataTableContext.Provider>
  );
}
