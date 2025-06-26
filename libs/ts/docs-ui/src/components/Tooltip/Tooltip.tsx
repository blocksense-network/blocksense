import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';

import { cn } from '@blocksense/docs-ui/utils';

export type TooltipProps = {
  position?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  contentClassName?: string;
};

const TooltipContent = ({ children }: TooltipProps) => children;

const positionClasses = {
  top: 'tooltip__content--top bottom-full left-1/2 -translate-x-1/2 mb-4',
  right: 'tooltip__content--right top-1/2 left-full -translate-y-1/2 ml-4',
  bottom: 'tooltip__content--bottom top-full left-1/2 -translate-x-1/2 mt-4',
  left: 'tooltip__content--left top-1/2 right-full -translate-y-1/2 mr-4',
};

const arrowClasses = {
  top: 'tooltip__arrow--top bottom-[-6px] left-1/2 -translate-x-1/2 border-b-black',
  right:
    'tooltip__arrow--right top-1/2 left-[-10px] -translate-y-1/2 border-r-black',
  bottom:
    'tooltip__arrow--bottom top-[-6px] left-1/2 -translate-x-1/2 border-t-black',
  left: 'tooltip__arrow--left top-1/2 right-[-10px] -translate-y-1/2 border-l-black',
};

export const Tooltip = ({
  position = 'top',
  children,
  contentClassName = '',
}: TooltipProps) => {
  const childrenArray = Children.toArray(children);
  const content = childrenArray.find(
    child => isValidElement(child) && child.type === TooltipContent,
  ) as ReactElement;
  const trigger = childrenArray.find(
    child => isValidElement(child) && child.type !== TooltipContent,
  ) as ReactElement;

  return (
    <div className="tooltip relative inline-flex items-center group">
      {trigger}
      {content && (
        <div
          className={cn(
            `tooltip__content absolute ${positionClasses[position]} hidden group-hover:block group-focus:block px-4 py-1.5 text-sm font-semibold border rounded-md shadow-md z-50 whitespace-nowrap border-neutral-200 text-gray-800 bg-white dark:bg-neutral-900 dark:border-neutral-600 dark:text-white ${contentClassName}`,
          )}
        >
          {content?.props.children}
          <div
            className={`tooltip__arrow absolute ${arrowClasses[position]} w-0 h-0 border-transparent invert border-solid border-4`}
          />
        </div>
      )}
    </div>
  );
};

Tooltip.Content = TooltipContent;
