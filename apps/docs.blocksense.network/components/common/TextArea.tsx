'use client';

import React, { useRef, useEffect, TextareaHTMLAttributes } from 'react';

import { cn } from '@blocksense/ui/utils';

const variants = {
  outline:
    'textarea__base--outline border border-neutral-200 focus:border-blue-500 bg-white/50 focus:border-blue-500',
  filled:
    'textarea__base--filled bg-gray-100 border border-gray-300 focus:border-blue-500',
  transparent:
    'textarea__base--transparent bg-transparent border border-neutral-200',
  error: 'textarea__base--error border border-red-500 focus:border-red-600',
};

type Variant = 'outline' | 'filled' | 'transparent' | 'error';
type LabelSize = 'text-sm' | 'text-base' | 'text-lg' | 'text-xl';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  variant?: Variant;
  labelSize?: LabelSize;
  error?: boolean;
  errorMessage?: string;
};

export const TextArea = ({
  label,
  name,
  value,
  className,
  variant = 'outline',
  labelSize = 'text-base',
  error = false,
  errorMessage,
  ...props
}: TextAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && textareaRef.current) {
        textareaRef.current.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="textarea__wrapper flex flex-col">
      {label && (
        <label
          htmlFor={name}
          className={cn('textarea__label mt-1 mb-1 font-medium', labelSize)}
        >
          {label}
        </label>
      )}
      <textarea
        id={name}
        ref={textareaRef}
        aria-label={label || 'TextArea'}
        aria-describedby={name ? `${name}-description` : undefined}
        className={cn(
          'textarea__base flex w-full min-h-9 px-2 py-1 rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 placeholder:text-gray-400 hover:border-neutral-400 focus:ring-0 focus:outline-none dark:bg-neutral-900 dark:border-neutral-600 dark:text-white',
          variants[variant],
          error ? 'border-red-500 focus:border-red-600' : '',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="textarea__error text-sm text-red-500 mt-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

TextArea.displayName = 'TextArea';
