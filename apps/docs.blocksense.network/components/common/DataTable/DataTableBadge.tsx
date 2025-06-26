'use client';

import { ReactNode } from 'react';

import { Badge } from '@blocksense/docs-ui/Badge';

import { cellHaveContent, noCellData } from './dataTableUtils';

type DataTableBadgeProps = {
  children: ReactNode;
  className?: string;
};

export const DataTableBadge = ({
  children,
  className,
}: DataTableBadgeProps) => {
  if (!cellHaveContent(children)) {
    return noCellData;
  }

  return (
    <Badge
      variant="outline"
      className={`badge--datatable px-2 m-0 text-primary-600 bold font-medium whitespace-nowrap hover:bg-neutral-50 hover:border-gray-600 ${className}`}
    >
      {children}
    </Badge>
  );
};
