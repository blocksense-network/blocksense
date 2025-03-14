'use client';

import React, {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';

import { cn } from '@blocksense/ui/utils';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

export function Table({ containerClassName, className, ...props }: TableProps) {
  return (
    <section
      className={cn(
        'table__container relative w-full overflow-auto rounded-md border border-neutral-200 dark:border-neutral-600',
        containerClassName,
      )}
    >
      <table
        className={cn(
          'table min-w-max w-full text-sm bg-white dark:bg-neutral-900',
          className,
        )}
        {...props}
      />
    </section>
  );
}

export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn(
        'table__caption py-2 text-md font-bold bg-gray-50 dark:bg-neutral-900',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'table__header bg-gray-50 dark:bg-neutral-900 text-xs font-bold border-b border-neutral-200 dark:border-neutral-600',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('table__body', className)} {...props} />;
}

export function TableFooter({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        'table__footer border-t border-t-neutral-200 font-medium dark:border-neutral-600',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'table__head px-4 py-3 text-left align-middle font-medium',
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'table__row border-b last:border-0 border-neutral-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-800',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('table__cell px-4 py-3 align-middle', className)}
      {...props}
    />
  );
}
