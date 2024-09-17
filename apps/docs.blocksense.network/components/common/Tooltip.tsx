import { cn } from '@/lib/utils';
import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';

type TooltipProps = {
  position?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  contentClassName?: string;
};

const TooltipContent = ({ children }: TooltipProps) => children;

const positionClasses = {
  top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
  right: 'top-1/2 left-full transform -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
  left: 'top-1/2 right-full transform -translate-y-1/2 mr-2',
};

const arrowClasses = {
  top: 'absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-b-4 border-b-black',
  right:
    'absolute top-1/2 left-[-10px] transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-transparent border-r-4 border-r-black',
  bottom:
    'absolute top-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-t-4 border-t-black',
  left: 'absolute top-1/2 right-[-10px] transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-transparent border-l-4 border-l-black',
};

export const Tooltip = ({
  position = 'top',
  children,
  contentClassName = '',
}: TooltipProps) => {
  const childrenArray = Children.toArray(children);

  const content = childrenArray.find(
    child =>
      isValidElement(child) && (child as ReactElement).type === TooltipContent,
  ) as ReactElement | undefined;

  const trigger = childrenArray.find(
    child =>
      isValidElement(child) && (child as ReactElement).type !== TooltipContent,
  ) as ReactElement | null;

  return (
    <div className="relative inline-flex items-center group">
      {trigger}
      {content && (
        <div
          className={cn(
            `absolute ${positionClasses[position]} hidden group-hover:block group-focus:block px-4 py-1.5 text-sm font-semibold border border-neutral-300 rounded-md shadow-md z-50 whitespace-nowrap text-gray-800 bg-white ${contentClassName}`,
          )}
        >
          {content?.props.children}
          <div className={`absolute ${arrowClasses[position]} border-solid`} />
        </div>
      )}
    </div>
  );
};

Tooltip.Content = TooltipContent;
