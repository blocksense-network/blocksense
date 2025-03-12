'use client';

import React, { ReactNode, LabelHTMLAttributes } from 'react';

import { cn } from '@blocksense/ui/utils';

type LabelProps = {
  className?: string;
  children?: ReactNode;
} & LabelHTMLAttributes<HTMLLabelElement>;

export const Label = ({ className, children, ...props }: LabelProps) => {
  const baseClasses =
    'label text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-white';

  const classNames = cn(baseClasses, className);

  return (
    <label className={classNames} {...props}>
      {children}
    </label>
  );
};
