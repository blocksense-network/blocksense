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
  accessor: (row: DataRowType) => any;
}

export interface DataTableProps {
  columns: ColumnDef[];
  data: DataType;
  filterCell?: string;
  hasToolbar?: boolean;
  getRowLink?: (row: DataRowType) => string;
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
        options: Array.from(new Set(data.map(d => String(column.accessor(d))))),
        selectedValues: [],
      });
    }
    return acc;
  }, []);
}

export function filterDataFromSearch(
  data: DataType,
  columns: ColumnDef[],
  filterCell: string,
  searchValue: string,
): DataType {
  if (!filterCell || !searchValue) return data;
  const col = columns.find(c => c.id === filterCell);
  if (!col) return data;
  return data.filter(row =>
    String(col.accessor(row)).toLowerCase().includes(searchValue.toLowerCase()),
  );
}

export function applyFacetedFilters(
  data: DataType,
  facetedFilters: FilterType[],
  columns: ColumnDef[],
): DataType {
  if (facetedFilters.length === 0) return data;

  return data.filter(row =>
    facetedFilters.every((filter: FilterType) =>
      filter.selectedValues.length === 0
        ? true
        : filter.selectedValues.some(
            val =>
              String(
                columns.find(c => c.id === filter.name)?.accessor(row),
              ).toLowerCase() === val.toLowerCase(),
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
    const cellA = col.accessor(a);
    const cellB = col.accessor(b);
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
