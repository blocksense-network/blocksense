import cn from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { forwardRef } from 'react';

type InputProps = ComponentProps<'input'> & { suffix?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, suffix, ...props }, forwardedRef) => (
    <div className="nx-relative nx-flex nx-items-center nx-text-gray-900 contrast-more:nx-text-gray-800 dark:nx-text-gray-300 contrast-more:dark:nx-text-gray-300">
      <input
        ref={forwardedRef}
        spellCheck={false}
        className={cn(
          className,
          'nx-block nx-w-full nx-appearance-none nx-border nx-rounded-lg nx-border-gray-200 nx-px-3 nx-py-2 nx-transition-colors',
          'nx-text-base nx-leading-tight md:nx-text-sm',
          'focus:nx-bg-white dark:focus:nx-bg-dark',
          'placeholder:nx-text-gray-500 dark:placeholder:nx-text-gray-400',
          'contrast-more:nx-border contrast-more:nx-border-current',
        )}
        {...props}
      />
      {suffix}
    </div>
  ),
);

Input.displayName = 'Input';
