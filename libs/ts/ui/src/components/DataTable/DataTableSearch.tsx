'use client';

import React, { useContext } from 'react';

import { Input } from '@blocksense/ui/Input';
import { DataTableContext } from './DataTableContext';

interface DataTableSearchProps {
  filterCellTitle?: string;
}

export function DataTableSearch({ filterCellTitle }: DataTableSearchProps) {
  const { searchValue, setSearchValue } = useContext(DataTableContext);

  return (
    <Input
      placeholder={`Filter ${filterCellTitle}...`}
      value={searchValue}
      onChange={e => setSearchValue(e.target.value)}
      className="h-8 w-full min-w-[250px] lg:w-[250px] mr-1 lg:mr-2 border-solid border-neutral-200 transition-all duration-200"
      type="search"
    />
  );
}
