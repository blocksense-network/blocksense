'use client';

import React, {
  useState,
  useEffect,
  ReactNode,
  createContext,
  useContext,
  useRef,
  HTMLAttributes,
} from 'react';

import { cn } from '../../utils';
import { Icon } from '@blocksense/ui/Icon';
import { Button } from '@blocksense/ui/Button';

type SelectProps = {
  children: ReactNode;
  value: string;
  onValueChangeAction: (value: string) => void;
  className?: string;
};

type SelectContextType = {
  selectedValue: string;
  onValueChangeAction: (value: string) => void;
  isOpen: boolean;
  toggleOpen: () => void;
};

const SelectContext = createContext<SelectContextType>({} as SelectContextType);

export const Select = ({
  children,
  value,
  onValueChangeAction,
  className,
}: SelectProps) => {
  const [selectedValue, setSelectedValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue);
    onValueChangeAction(newValue);
    setIsOpen(false);
  };

  const toggleOpen = () => {
    setIsOpen(state => !state);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      selectRef.current &&
      !selectRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <SelectContext.Provider
      value={{
        selectedValue,
        onValueChangeAction: handleChange,
        isOpen,
        toggleOpen,
      }}
    >
      <div ref={selectRef} className={cn('select relative', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

type SelectTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  className?: string;
  children: ReactNode;
};

export const SelectTrigger = ({
  className,
  children,
  ...props
}: SelectTriggerProps) => {
  const { toggleOpen, isOpen } = useContext(SelectContext);

  return (
    <Button
      className={cn(
        'select__trigger flex gap-1 h-10 mt-0 w-full items-center justify-between rounded-md px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onClick={toggleOpen}
      {...props}
    >
      {children}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 dark:invert transition-transform duration-200',
          isOpen ? 'rotate-180' : 'rotate-0',
        )}
        size="xs"
        icon={{
          type: 'image',
          src: '/icons/chevron-down.svg',
        }}
        ariaLabel="Down Arrow"
      />
    </Button>
  );
};

type SelectValueProps = HTMLAttributes<HTMLSpanElement> & {
  placeholder: string | number;
  className?: string;
};

export const SelectValue = ({
  placeholder,
  className,
  ...props
}: SelectValueProps) => {
  const { selectedValue } = useContext(SelectContext);

  return (
    <span className={cn('select__value line-clamp-1', className)} {...props}>
      {selectedValue || String(placeholder)}
    </span>
  );
};

type Side = 'top' | 'bottom';
type Align = 'start' | 'center' | 'end';

function getSideAlignClasses(side: Side, align: Align): string {
  let sideClass = '';
  let alignClass = '';
  let marginClass = '';

  switch (side) {
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

  return `${sideClass} ${alignClass} ${marginClass}`;
}

type SelectContentProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: ReactNode;
  side?: Side;
  align?: Align;
};

export const SelectContent = ({
  className,
  children,
  side = 'bottom',
  align = 'start',
  ...props
}: SelectContentProps) => {
  const { isOpen } = useContext(SelectContext);
  const positionClasses = getSideAlignClasses(side, align);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'select__content absolute bg-white dark:bg-neutral-900 z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-600 hover:border-blue-500 shadow-md',
        positionClasses,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

type SelectItemProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  value: string;
  children: ReactNode;
};

export const SelectItem = ({
  className,
  value,
  children,
  ...props
}: SelectItemProps) => {
  const { selectedValue, onValueChangeAction } = useContext(SelectContext);

  return (
    <div
      onClick={() => onValueChangeAction(value)}
      className={cn(
        'select__item relative flex cursor-default m-1 select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm hover:outline hover:outline-blue-500',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex items-center justify-center">
        {selectedValue === value && (
          <Icon
            className="dark:invert opacity-100"
            size="xs"
            icon={{
              type: 'image',
              src: '/icons/check.svg',
            }}
            ariaLabel="Check"
          />
        )}
      </span>
      {children}
    </div>
  );
};

type SelectLabelProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: ReactNode;
};

export const SelectLabel = ({
  className,
  children,
  ...props
}: SelectLabelProps) => {
  return (
    <div
      className={cn(
        'select__label relative cursor-default m-1 select-none py-1.5 pl-8 pr-2 font-bold text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
