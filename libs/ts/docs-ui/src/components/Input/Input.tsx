'use client';

import React from 'react';
import { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@blocksense/docs-ui/utils';

type Variant = 'outline' | 'filled' | 'transparent' | 'error';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const variants = {
  outline:
    'input__base--outline border border-neutral-200 focus:border-blue-500 bg-white/50 focus:border-blue-500',
  filled:
    'input__base--filled bg-gray-100 border border-gray-300 focus:border-blue-500',
  transparent:
    'input__base--transparent bg-transparent border border-neutral-200',
  error: 'input__base--error border border-red-500 focus:border-red-600',
};

const sizes = {
  sm: 'h-8 text-sm px-2',
  md: 'h-10 text-base px-3',
  lg: 'h-12 text-lg px-4',
  xl: 'h-14 text-xl px-5',
};

type InputBaseProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: Variant;
  inputSize?: Size;
  icon?: ReactNode;
  error?: boolean;
};

export const InputBase = ({
  className,
  variant = 'outline',
  inputSize = 'sm',
  disabled = false,
  type = 'text',
  error = false,
  icon,
  ...props
}: InputBaseProps) => {
  const baseClasses =
    'input__base flex w-full rounded-md bg-background transition-colors disabled:pointer-events-none disabled:opacity-50 placeholder:text-gray-400 hover:border-neutral-400 focus:ring-0 focus:outline-none dark:bg-neutral-900 dark:border-neutral-600 dark:text-white';

  const errorClasses = error ? 'border-red-500 focus:border-red-600' : '';

  const paddingLeft = icon ? 'pl-10' : 'pl-3';

  const classNames = cn(
    baseClasses,
    variants[variant],
    sizes[inputSize],
    errorClasses,
    paddingLeft,
    className,
  );

  return (
    <input className={classNames} type={type} disabled={disabled} {...props} />
  );
};

type InputProps = InputBaseProps & {
  errorMessage?: string;
};

export const Input = ({
  className,
  variant = 'outline',
  inputSize = 'md',
  disabled = false,
  errorMessage,
  type = 'text',
  error = false,
  icon,
  ...props
}: InputProps) => {
  return (
    <section className="input__wrapper relative">
      {icon && (
        <span className="input__icon absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
          {icon}
        </span>
      )}
      <InputBase
        className={className}
        variant={variant}
        inputSize={inputSize}
        disabled={disabled}
        type={type}
        error={error}
        icon={icon}
        {...props}
      />
      {error && <p className="text-sm text-red-500 mt-1">{errorMessage}</p>}
    </section>
  );
};

Input.displayName = 'Input';
