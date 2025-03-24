'use client';

import { ReactNode } from 'react';

import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

interface DataTableColumnHeaderProps {
  title: ReactNode;
}

export function DataTableColumnHeader({ title }: DataTableColumnHeaderProps) {
  return (
    <article className="data-table__column-header cursor-pointer flex items-center">
      <span className="capitalize text-sm">{title}</span>
      <ImageWrapper
        src="/icons/arrow-up-down.svg"
        alt="Arrow up down"
        className="ml-2 h-4 w-4 invert"
      />
    </article>
  );
}
