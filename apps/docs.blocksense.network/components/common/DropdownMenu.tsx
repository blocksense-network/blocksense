'use client';

import {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
  HTMLAttributes,
  ReactNode,
  RefObject,
  MouseEvent,
} from 'react';

import { cn } from '@/lib/utils';
import { Icon } from '@blocksense/ui/Icon';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  menuRef: RefObject<HTMLDivElement>;
}
const DropdownContext = createContext<DropdownContextValue>(
  {} as DropdownContextValue,
);

export const DropdownMenu = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const toggle = () => {
    setOpen(state => !state);
  };

  return (
    <DropdownContext.Provider value={{ open, setOpen, menuRef, toggle }}>
      <div ref={menuRef} className="dropdown-menu relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export const DropdownMenuTrigger = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => {
  const { toggle } = useContext(DropdownContext);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    toggle();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      {...props}
      className={cn('dropdown-menu__trigger cursor-pointer', props.className)}
    >
      {children}
    </div>
  );
};

type Side = 'left' | 'right' | 'top' | 'bottom';
type Align = 'start' | 'center' | 'end';

function getSideAlignClasses(side: Side, align: Align): string {
  let sideClass = '';
  let alignClass = '';
  let marginClass = '';

  switch (side) {
    case 'left':
      sideClass = 'right-full';
      marginClass = 'mr-2';
      break;
    case 'right':
      sideClass = 'left-full';
      marginClass = 'ml-2';
      break;
    case 'top':
      sideClass = 'bottom-full';
      marginClass = 'mb-2';
      break;
    case 'bottom':
      sideClass = 'top-full';
      marginClass = 'mt-2';
      break;
    default:
      sideClass = 'top-full';
      marginClass = 'mt-2';
  }

  if (side === 'left' || side === 'right') {
    switch (align) {
      case 'start':
        alignClass = 'top-0';
        break;
      case 'center':
        alignClass = 'top-1/2 -translate-y-1/2';
        break;
      case 'end':
        alignClass = 'bottom-0';
        break;
      default:
        alignClass = 'top-0';
    }
  } else {
    switch (align) {
      case 'start':
        alignClass = 'left-0';
        break;
      case 'center':
        alignClass = 'left-1/2 -translate-x-1/2';
        break;
      case 'end':
        alignClass = 'right-0';
        break;
      default:
        alignClass = 'left-0';
    }
  }

  return `${sideClass} ${alignClass} ${marginClass}`;
}

export const DropdownMenuContent = ({
  className,
  children,
  side = 'bottom',
  align = 'start',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  align?: Align;
  side?: Side;
}) => {
  const { open } = useContext(DropdownContext);
  const positionClasses = getSideAlignClasses(side, align);

  return (
    <div
      className={cn(
        'dropdown-menu__content absolute bg-white dark:bg-neutral-900 z-30 min-w-[8rem] overflow-visible rounded-md border border-neutral-200 dark:border-neutral-600 hover:border-blue-500 shadow-md transition-all duration-200 ease-in-out transform origin-top-left py-1',
        open
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-90 pointer-events-none',
        positionClasses,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({
  inset,
  className,
  children,
  disabled,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  children: ReactNode;
  disabled?: boolean;
}) => {
  return (
    <div
      className={cn(
        'dropdown-menu__item relative hover:border-y hover:border-y-blue-500 cursor-pointer flex select-none items-center rounded-xs px-2.5 py-2 text-sm outline-none',
        inset && 'pl-8',
        className,
        disabled && 'opacity-50 pointer-events-none',
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuCheckboxItem = ({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) => {
  const handleClick = () => {
    onCheckedChange(!checked);
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      className={cn('dropdown-menu__checkbox-item pr-2', className)}
      {...props}
    >
      <span className="mr-2 flex items-center justify-center">
        <Icon
          icon={{
            type: 'image',
            src: '/icons/check.svg',
          }}
          ariaLabel="Check"
          className={`dark:invert ${checked ? 'opacity-100' : 'opacity-0'}`}
          size="xs"
        />
      </span>
      {children}
    </DropdownMenuItem>
  );
};

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const DropdownMenuRadioGroupContext = createContext<RadioGroupContextValue>({});

export const DropdownMenuRadioGroup = ({
  value,
  onValueChange,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) => {
  return (
    <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
      <div
        {...props}
        className={cn('dropdown-menu__radio-group', props.className)}
      >
        {children}
      </div>
    </DropdownMenuRadioGroupContext.Provider>
  );
};

interface DropdownMenuRadioItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const DropdownMenuRadioItem = ({
  className,
  children,
  value,
  ...props
}: DropdownMenuRadioItemProps) => {
  const radioGroup = useContext(DropdownMenuRadioGroupContext);
  const selected = radioGroup ? radioGroup.value === value : false;

  const handleClick = () => {
    if (radioGroup && radioGroup.onValueChange) {
      radioGroup.onValueChange(value);
    }
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      className={cn('dropdown-menu__radio-item pr-2', className)}
      {...props}
    >
      <span className="mr-2 flex h-2.5 w-2.5 items-center justify-center">
        <Icon
          icon={{
            type: 'image',
            src: '/icons/circle.svg',
          }}
          ariaLabel="Circle"
          className={`fill-current dark:invert ${selected ? 'opacity-100' : 'opacity-0'}`}
        />
      </span>
      {children}
    </DropdownMenuItem>
  );
};

export const DropdownMenuLabel = ({
  inset,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  children: ReactNode;
}) => {
  return (
    <div
      className={cn(
        'dropdown-menu__label px-2.5 py-2 text-sm font-semibold',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'dropdown-menu__separator my-1 h-px bg-neutral-200 dark:bg-neutral-500',
        className,
      )}
      {...props}
    />
  );
};

export const DropdownMenuShortcut = ({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'dropdown-menu__shortcut ml-auto text-xs tracking-widest opacity-60',
        className,
      )}
      {...props}
    />
  );
};

export const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  submenu,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
  children: ReactNode;
  submenu: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn('dropdown-menu__sub-trigger relative', className)}
      onClick={() => setOpen(state => !state)}
      {...props}
    >
      <DropdownMenuItem inset={inset}>
        {children}
        <Icon
          icon={{
            type: 'image',
            src: '/icons/chevron-right.svg',
          }}
          ariaLabel="Chevron Right"
          className="ml-auto dark:invert"
          size="xs"
        />
      </DropdownMenuItem>
      {open && submenu}
    </div>
  );
};
