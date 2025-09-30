'use client';

import React from 'react';
import type { HTMLAttributes } from 'react';

import { cn } from '@blocksense/docs-ui/utils';

type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  semanticRole?: boolean;
};

export const Separator = ({
  className,
  orientation = 'horizontal',
  semanticRole = false,
  ...props
}: SeparatorProps) => {
  return (
    <div
      role={semanticRole ? 'separator' : 'presentation'}
      aria-orientation={semanticRole ? orientation : undefined}
      className={cn(
        'separator bg-neutral-200 dark:bg-neutral-600',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className,
      )}
      {...props}
    />
  );
};
