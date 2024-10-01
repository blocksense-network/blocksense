import React from 'react';

import { Badge } from '@/components/ui/badge';

type DataTableBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export const DataTableBadge = ({
  children,
  className,
}: DataTableBadgeProps) => {
  if (children === null || children === undefined || children === '') {
    return '-';
  }

  return (
    <Badge
      variant="outline"
      className={`border-solid border-slate-200 px-2 m-0 text-primary-600 bold font-medium whitespace-nowrap hover:bg-neutral-50 hover:border-gray-600 ${className}`}
    >
      {children}
    </Badge>
  );
};
