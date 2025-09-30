'use client';

import React from 'react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@blocksense/docs-ui/utils';

const typeToEmoji = {
  default: 'ℹ️',
  error: '❌',
  info: '💡',
  warning: '⚠️',
};

export type CalloutProps = {
  type?: 'default' | 'error' | 'info' | 'warning';
  emoji?: string | ReactElement;
  title?: string;
  children: ReactNode;
  className?: string;
};

export const Callout = ({
  children,
  className,
  emoji,
  title,
  type = 'default',
}: CalloutProps) => {
  const defaultEmoji = typeToEmoji[type];

  return (
    <article
      className={cn(
        'callout callout--base flex rounded-sm p-2 my-4 border shadow-sm relative',
        {
          'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900 dark:border-blue-300 dark:text-blue-100':
            type === 'info',
          'bg-yellow-100 border-yellow-500 text-yellow-900 dark:bg-yellow-900 dark:border-yellow-300 dark:text-yellow-100':
            type === 'warning',
          'bg-red-100 border-red-500 text-red-900 dark:bg-red-900 dark:border-red-300 dark:text-red-100':
            type === 'error',
          'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-900 dark:border-gray-300 dark:text-gray-100':
            type === 'default',
        },
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <header className="flex flex-col items-center gap-2 mb-3">
        <figure className="callout__emoji-container flex flex-col items-center gap-4 mr-2">
          <span className="callout__emoji text-lg" aria-hidden="true">
            {emoji || defaultEmoji}
          </span>
        </figure>
      </header>
      <aside className="callout__content text-sm leading-relaxed">
        {title && (
          <h2 className="callout__title font-semibold text-base mb-1">
            {title}
          </h2>
        )}
        {children}
      </aside>
    </article>
  );
};

Callout.displayName = 'Callout';
