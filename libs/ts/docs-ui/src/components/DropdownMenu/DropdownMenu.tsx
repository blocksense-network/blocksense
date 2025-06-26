'use client';

import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
  HTMLAttributes,
  ReactNode,
  RefObject,
  MouseEvent,
  ChangeEvent,
} from 'react';

import { Icon } from '@blocksense/docs-ui/Icon';
import {
  cn,
  getSideAlignClasses,
  Align,
  Side,
} from '@blocksense/docs-ui/utils';
import { Checkbox } from '@blocksense/docs-ui/Checkbox';

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
  children: string;
}) => {
  const [dropdownChecked, setDropdownChecked] = useState(checked);

  useEffect(() => {
    onCheckedChange(dropdownChecked);
  }, [dropdownChecked]);

  const handleClick = () => {
    setDropdownChecked(state => !state);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDropdownChecked(e.target.checked);
  };

  return (
    <DropdownMenuItem
      onClick={handleClick}
      className={cn('dropdown-menu__checkbox-item pr-2', className)}
      {...props}
    >
      <Checkbox
        id={children}
        value={children}
        checked={dropdownChecked}
        onChange={handleChange}
      >
        {children}
      </Checkbox>
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
