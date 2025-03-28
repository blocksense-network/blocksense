'use client';

import React from 'react';

import {
  DataTable,
  DataTableBadge,
  DataTableColumnHeader,
} from '@blocksense/ui/DataTable';
import { Tooltip } from '@blocksense/ui/Tooltip';

export default {
  title: 'Components/DataTable',
  component: DataTable,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

const defaultColumns = [
  {
    id: 'id',
    title: 'ID',
    header: ({ column }) => column.title,
    cell: ({ row }) => row.id,
  },
  {
    id: 'name',
    title: 'Name',
    header: ({ column }) => column.title,
    cell: ({ row }) => row.name,
  },
  {
    id: 'age',
    title: 'Age',
    header: ({ column }) => column.title,
    cell: ({ row }) => row.age,
  },
];

const defaultData = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
];

export const Default = () => (
  <DataTable columns={defaultColumns} data={defaultData} />
);

export const WithToolbar = () => (
  <DataTable
    columns={defaultColumns}
    data={defaultData}
    filterCell="name"
    hasToolbar
  />
);

export const withFacetedFilter = () => {
  const defaultColumnsWithFacetedFilter = [
    ...defaultColumns.slice(0, 2),
    {
      ...defaultColumns[2],
      facetedFilter: true,
    },
  ];

  return (
    <DataTable
      columns={defaultColumnsWithFacetedFilter}
      data={defaultData}
      filterCell="name"
      hasToolbar
    />
  );
};

const manyRows = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  age: 20 + (i % 10),
}));

export const Pagination = () => (
  <div className="p-4">
    <DataTable
      columns={defaultColumns}
      data={manyRows}
      filterCell="name"
      hasToolbar
    />
  </div>
);

const advancedColumns = [
  {
    id: 'id',
    title: 'ID',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.id}</DataTableBadge>,
    facetedFilter: true,
  },
  {
    id: 'description',
    title: 'Description',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => (
      <Tooltip position="right">
        <Tooltip.Content>{`Info: ${row.description}`}</Tooltip.Content>
        <DataTableBadge>{row.description}</DataTableBadge>
      </Tooltip>
    ),
    facetedFilter: true,
  },
  {
    id: 'value',
    title: 'Value',
    header: ({ column }) => <DataTableColumnHeader title={column.title} />,
    cell: ({ row }) => <DataTableBadge>{row.value}</DataTableBadge>,
  },
];

const advancedData = [
  { id: 1, description: 'Feed A', value: 10 },
  { id: 2, description: 'Feed B', value: 20 },
  { id: 3, description: 'Feed C', value: 30 },
];

export const Advanced = () => (
  <DataTable
    columns={advancedColumns}
    data={advancedData}
    filterCell="description"
    rowLink="/datafeed/"
    hasToolbar
  />
);

export const NoData = () => (
  <DataTable columns={defaultColumns} data={[]} filterCell="name" hasToolbar />
);
