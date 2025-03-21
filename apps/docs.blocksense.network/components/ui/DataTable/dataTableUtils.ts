import { FilterType, SortingType, ColumnDef } from './DataTable';

export function getFacetedFilters(
  columns: ColumnDef[],
  data: any[],
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
  data: any[],
  filterKey: string,
  searchValue: string,
): any[] {
  if (!filterKey || !searchValue) return data;
  return data.filter(row =>
    String(row[filterKey]).toLowerCase().includes(searchValue.toLowerCase()),
  );
}

export function applyFacetedFilters(
  data: any[],
  facetedFilters: FilterType[],
): any[] {
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
  data: any[],
  columns: { id: string }[],
  sorting: SortingType,
): any[] {
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
