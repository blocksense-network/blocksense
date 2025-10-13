'use client';

import React from 'react';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@blocksense/docs-ui/utils';

type SwitchProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Switch = ({ checked, onCheckedChange, ...props }: SwitchProps) => {
  const baseClasses =
    'switch peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border border-neutral-200 rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600';
  const checkedClasses = 'bg-primary';
  const uncheckedClasses = 'bg-input';
  const thumbClasses =
    'switch__thumb pointer-events-none block h-5 w-5 rounded-full bg-neutral-200 shadow-lg ring-0 transition-transform dark:bg-neutral-500';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      className={cn(
        baseClasses,
        checked ? checkedClasses : uncheckedClasses,
        props.className,
      )}
      {...props}
    >
      <span
        className={cn(
          thumbClasses,
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
};
