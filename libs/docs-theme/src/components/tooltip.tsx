import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';

type TooltipProps = {
  children: ReactNode;
};

const TooltipContent = ({ children }: TooltipProps) => children;

const positionClass = 'top-full left-1/2 transform -translate-x-1/2 mt-2';

const arrowClass =
  'absolute top-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-t-4 border-t-black';

export const Tooltip = ({ children }: TooltipProps) => {
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
      <div
        className={`absolute ${positionClass} hidden group-hover:block group-focus:block px-4 py-1.5 text-sm font-semibold text-gray-800 nx-bg-white nx-border-b nx-border-neutral-300 rounded-md shadow-md z-50 whitespace-nowrap`}
      >
        {content?.props.children}
        <div className={`absolute ${arrowClass} border-solid`} />
      </div>
    </div>
  );
};

Tooltip.Content = TooltipContent;
