import { ReactNode } from 'react';

export type SortingType = { column: string; order: 'asc' | 'desc' };

export type FilterType = {
  name: string;
  title: string;
  options: string[];
  selectedValues: string[];
};

export type DataRowType = any;

export type DataType = DataRowType[];

export interface ColumnDef {
  id: string;
  title: string;
  header: (args: { column: ColumnDef }) => ReactNode;
  cell?: (args: { row: DataRowType }) => ReactNode;
  invisible?: boolean;
  facetedFilter?: boolean;
}

export interface DataTableProps {
  columns: ColumnDef[];
  data: DataType;
  filterCell?: string;
  hasToolbar?: boolean;
  rowLink?: string;
}

export function getFacetedFilters(
  columns: ColumnDef[],
  data: DataType,
): FilterType[] {
  return columns.reduce<FilterType[]>((acc, column) => {
    if (column.facetedFilter) {
      acc.push({
        name: column.id,
        title: column.title,
        options: Array.from(new Set(data.map(d => String(d[column.id])))),
        selectedValues: [],
      });
    }
    return acc;
  }, []);
}

export function filterDataFromSearch(
  data: DataType,
  filterCell: string,
  searchValue: string,
): DataType {
  if (!filterCell || !searchValue) return data;
  return data.filter(row =>
    String(row[filterCell]).toLowerCase().includes(searchValue.toLowerCase()),
  );
}

export function applyFacetedFilters(
  data: DataType,
  facetedFilters: FilterType[],
): DataType {
  if (facetedFilters.length === 0) return data;

  return data.filter(row =>
    facetedFilters.every((filter: FilterType) =>
      filter.selectedValues.length === 0
        ? true
        : filter.selectedValues.some(
            (val: string) =>
              String(row[filter.name]).toLowerCase() === val.toLowerCase(),
          ),
    ),
  );
}

export function sortData(
  data: DataType,
  columns: ColumnDef[],
  sorting: SortingType,
): DataType {
  if (!sorting) return data;
  const col = columns.find(c => c.id === sorting.column);
  if (!col) return data;

  return [...data].sort((a, b) => {
    const cellA = a[col.id];
    const cellB = b[col.id];
    if (cellA < cellB) return sorting.order === 'asc' ? -1 : 1;
    if (cellA > cellB) return sorting.order === 'asc' ? 1 : -1;
    return 0;
  });
}

export function getSortingState(
  colId: string,
  sorting: SortingType,
): SortingType {
  if (sorting && sorting.column === colId) {
    return {
      column: colId,
      order: sorting.order === 'asc' ? 'desc' : 'asc',
    };
  } else {
    return { column: colId, order: 'asc' };
  }
}

export function cellHaveContent(children: any) {
  if (children === null || children === undefined || children === '') {
    return false;
  }
  return true;
}

export const noCellData = '-';
