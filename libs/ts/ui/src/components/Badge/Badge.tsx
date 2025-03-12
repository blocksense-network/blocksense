'use client';

import React, { ReactNode } from 'react';

import { cn } from '@blocksense/ui/utils';

type Variant = 'primary' | 'highlight' | 'accentary' | 'danger' | 'outline';

const variants = {
  primary:
    'badge--primary bg-primary text-primary-foreground border-transparent hover:bg-primary/80',
  highlight:
    'badge--highlight bg-highlight text-highlight-foreground border-transparent hover:bg-highlight/80',
  accentary:
    'badge--accentary text-accentary-foreground border-transparent bg-sky-700 hover:bg-accentary/80',
  danger:
    'badge--danger bg-danger text-danger-foreground border-transparent hover:bg-danger/80',
  outline: 'badge--outline text-foreground',
};

type BadgeProps = {
  className?: string;
  variant?: Variant;
  children?: ReactNode;
};

export const Badge = ({
  className,
  variant = 'primary',
  children,
  ...props
}: BadgeProps) => {
  const baseClasses =
    'badge inline-flex items-center rounded-full border px-2.5 py-0.5 mr-4 mt-4 mb-4 text-sm font-semibold border-neutral-200 transition-colors hover:bg-neutral-50 hover:border-gray-300 focus:ring-1 focus:ring-gray-300 focus:ring-offset-0 focus:ring-opacity-100 focus:ring-offset-transparent focus:ring-offset-none focus:shadow-sm border border-gray-200 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:hover:bg-black';

  const classNames = cn(baseClasses, variants[variant], className);

  return (
    <span className={classNames} {...props}>
      {children}
    </span>
  );
};
