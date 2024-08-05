import React, { ReactNode, ReactElement } from 'react';

type TooltipContentProps = {
  children: ReactNode;
};

const TooltipContent = ({ children }: TooltipContentProps) => <>{children}</>;

type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  position?: TooltipPosition;
  children: React.ReactNode;
};

const positionClasses: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
  right: 'top-1/2 left-full transform -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
  left: 'top-1/2 right-full transform -translate-y-1/2 mr-2',
};

const arrowClasses: Record<TooltipPosition, string> = {
  top: 'absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-b-4 border-b-black',
  right:
    'absolute top-1/2 left-[-10px] transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-transparent border-r-4 border-r-black',
  bottom:
    'absolute top-[-6px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-transparent border-t-4 border-t-black',
  left: 'absolute top-1/2 right-[-10px] transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-transparent border-l-4 border-l-black',
};

export const Tooltip = ({ position = 'top', children }: TooltipProps) => {
  const [trigger, content] = React.Children.toArray(children).reduce<
    [ReactElement<any> | null, ReactNode]
  >(
    ([trigger, content], child) => {
      if (React.isValidElement(child)) {
        if (child.type === TooltipContent) {
          return [trigger, child.props.children];
        }
        return [child, content];
      }
      return [trigger, content];
    },
    [null, null],
  );

  return (
    <div className="relative inline-flex items-center group">
      {trigger}
      <div
        className={`absolute ${positionClasses[position]} hidden group-hover:block group-focus:block px-4 py-1.5 text-sm font-semibold text-gray-800 bg-white border border-neutral-300 rounded-md shadow-md z-50`}
      >
        {content}
        <div className={`absolute ${arrowClasses[position]} border-solid`} />
      </div>
    </div>
  );
};

Tooltip.Content = TooltipContent;
