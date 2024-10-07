import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';
import cn from 'clsx';
import { InformationCircleIcon } from '../icons/information-circle';

const TypeToEmoji = {
  default: '💡',
  error: '🚫',
  info: <InformationCircleIcon />,
  warning: '⚠️',
};

type CalloutType = keyof typeof TypeToEmoji;

const classes: Record<CalloutType, string> = {
  default: cn(
    'nx-border-orange-100 nx-bg-orange-50 nx-text-orange-800 dark:nx-border-orange-400/30 dark:nx-bg-orange-400/20 dark:nx-text-orange-300',
  ),
  error: cn(
    'nx-border-red-200 nx-bg-red-100 nx-text-red-900 dark:nx-border-red-200/30 dark:nx-bg-red-900/30 dark:nx-text-red-200',
  ),
  info: cn('nx-text-gray-500 nx-leading-6'),
  warning: cn(
    'nx-border-yellow-100 nx-bg-yellow-50 nx-text-yellow-900 dark:nx-border-yellow-200/30 dark:nx-bg-yellow-700/30 dark:nx-text-yellow-200',
  ),
};

export type CalloutProps = ComponentProps<'div'> & {
  type?: CalloutType;
  emoji?: string | ReactNode;
  children: ReactNode;
};

export const Callout = forwardRef<HTMLDivElement, CalloutProps>(function (
  { children, type = 'default', emoji = TypeToEmoji[type], ...props },
  forwardedRef,
): ReactElement {
  return (
    <div
      ref={forwardedRef}
      className={cn(
        'nextra-callout nx-overflow-x-auto nx-mt-6 nx-py-4 nx-pl-2 nx-pr-4 nx-flex nx-bg-neutral-900 nx-bg-opacity-[0.02] nx-rounded-md nx-border nx-border-neutral-200/70 ltr:nx-pr-4 rtl:nx-pl-4',
        'contrast-more:nx-border-current contrast-more:dark:nx-border-current',
        classes[type],
      )}
      {...props}
    >
      <div
        className="nx-select-none nx-text-xl ltr:nx-pl-3 ltr:nx-pr-2 rtl:nx-pr-3 rtl:nx-pl-2"
        style={{
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        }}
      >
        {emoji}
      </div>
      <div className="nx-w-full nx-min-w-0 nx-leading-6 nx-pointer-events-none">
        {children}
      </div>
    </div>
  );
});

Callout.displayName = 'Callout';
