'use client';

import React, { useContext } from 'react';

import { Button } from '@blocksense/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@blocksense/ui/Select';
import { DataTableContext } from './DataTableContext';

export function DataTablePagination() {
  const { pagination, setPagination, totalRows } = useContext(DataTableContext);
  const totalPages = Math.ceil(totalRows / pagination.pageSize);

  return (
    <section className="flex items-center justify-between px-2">
      <article className="flex items-center space-x-2">
        <p className="text-sm font-medium">Rows per page</p>
        <Select
          value={`${pagination.pageSize}`}
          onValueChangeAction={(value: string) => {
            setPagination({ pageIndex: 0, pageSize: Number(value) });
          }}
        >
          <SelectTrigger className="h-8 w-[60px]">
            <SelectValue placeholder={`${pagination.pageSize}`} />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 30, 50, 100].map(pageSize => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </article>
      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
        Page {pagination.pageIndex + 1} of {totalPages}
      </div>
      <section className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex border-neutral-200"
          onClick={() => setPagination({ ...pagination, pageIndex: 0 })}
          disabled={pagination.pageIndex === 0}
        >
          <span className="sr-only">Go to first page</span>
          {'<<'}
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0 border-neutral-200"
          onClick={() =>
            setPagination({
              ...pagination,
              pageIndex: pagination.pageIndex - 1,
            })
          }
          disabled={pagination.pageIndex === 0}
        >
          <span className="sr-only">Go to previous page</span>
          {'<'}
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0 border-neutral-200"
          onClick={() =>
            setPagination({
              ...pagination,
              pageIndex: pagination.pageIndex + 1,
            })
          }
          disabled={pagination.pageIndex + 1 >= totalPages}
        >
          <span className="sr-only">Go to next page</span>
          {'>'}
        </Button>
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex border-neutral-200"
          onClick={() =>
            setPagination({ ...pagination, pageIndex: totalPages - 1 })
          }
          disabled={pagination.pageIndex + 1 >= totalPages}
        >
          <span className="sr-only">Go to last page</span>
          {'>>'}
        </Button>
      </section>
    </section>
  );
}
