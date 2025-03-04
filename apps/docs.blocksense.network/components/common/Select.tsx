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

import { cn } from '@/lib/utils';
import { Icon } from '@blocksense/ui/Icon';
import { Button } from '@blocksense/ui/Button';

type SelectProps = {
  children: ReactNode;
  value: string;
  onValueChangeAction: (value: string) => void;
};

type SelectContextType = {
  selectedValue: string;
  onValueChangeAction: (value: string) => void;
  isOpen: boolean;
  toggleOpen: () => void;
};

const SelectContext = createContext<SelectContextType | undefined>(undefined);

export const Select = ({
  children,
  value,
  onValueChangeAction,
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
    setIsOpen(!isOpen);
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
      <div ref={selectRef} className="select">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

type SelectTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  className?: string;
  children: ReactNode;
  side: 'top' | 'bottom';
};

export const SelectTrigger = ({
  className,
  children,
  side,
  ...props
}: SelectTriggerProps) => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('SelectTrigger must be used within a Select');
  }

  const { toggleOpen, isOpen } = context;

  return (
    <Button
      className={cn(
        'select__trigger flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onClick={toggleOpen}
      {...props}
    >
      {children}
      {side === 'top' ? (
        isOpen ? (
          <Icon
            className="p-0.5 dark:invert opacity-60"
            size="xs"
            icon={{
              type: 'image',
              src: '/icons/chevron-up.svg',
            }}
            ariaLabel="Up Arrow"
          />
        ) : (
          <Icon
            className="dark:invert opacity-55"
            size="xs"
            icon={{
              type: 'image',
              src: '/icons/chevron-down.svg',
            }}
            ariaLabel="Down Arrow"
          />
        )
      ) : isOpen ? (
        <Icon
          className="dark:invert opacity-55"
          size="xs"
          icon={{
            type: 'image',
            src: '/icons/chevron-down.svg',
          }}
          ariaLabel="Down Arrow"
        />
      ) : (
        <Icon
          className="p-0.5 dark:invert opacity-60"
          size="xs"
          icon={{
            type: 'image',
            src: '/icons/chevron-up.svg',
          }}
          ariaLabel="Up Arrow"
        />
      )}
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
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('SelectValue must be used within a Select');
  }

  return (
    <span className={cn('select__value line-clamp-1', className)} {...props}>
      {context.selectedValue || String(placeholder)}
    </span>
  );
};

type SelectContentProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  children: ReactNode;
};

export const SelectContent = ({
  className,
  children,
  ...props
}: SelectContentProps) => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('SelectContent must be used within a Select');
  }

  const { isOpen } = context;

  return isOpen ? (
    <div
      className={cn(
        'select__content absolute mr-2 z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ) : null;
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
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('SelectItem must be used within a Select');
  }

  const { selectedValue, onValueChangeAction } = context;

  return (
    <div
      onClick={() => onValueChangeAction(value)}
      className={cn(
        'select__item relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm focus:bg-accent focus:text-accent-foreground hover:outline hover:outline-blue-500 hover:rounded-lg',
        selectedValue === value ? 'bg-accent text-accent-foreground' : '',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
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
