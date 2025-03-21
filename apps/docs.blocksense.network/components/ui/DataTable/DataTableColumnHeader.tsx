'use client';

import { ReactNode } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface DataTableColumnHeaderProps {
  title: ReactNode;
}

export function DataTableColumnHeader({ title }: DataTableColumnHeaderProps) {
  return (
    <div className="cursor-pointer flex items-center">
      <span className="capitalize text-sm">{title}</span>
      <div className="h-4 w-4">
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </div>
    </div>
  );
}
