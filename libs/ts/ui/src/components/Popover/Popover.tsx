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
} from 'react';

import { cn, getSideAlignClasses, Align, Side } from '@blocksense/ui/utils';

interface PopoverContextValue {
  isOpen: boolean;
  toggleOpen: () => void;
  popoverRef: RefObject<HTMLDivElement>;
}

const PopoverContext = createContext<PopoverContextValue>(
  {} as PopoverContextValue,
);

export const Popover = ({ children }: { children: ReactNode }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(state => !state);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: Event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const focusInputElement = () => {
      const inputElement = document.querySelector(
        '.command-input__field',
      ) as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    focusInputElement();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <PopoverContext.Provider value={{ isOpen, toggleOpen, popoverRef }}>
      <div ref={popoverRef} className="popover relative">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

type PopoverTriggerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const PopoverTrigger = ({
  children,
  className,
  ...props
}: PopoverTriggerProps) => {
  const { toggleOpen, isOpen } = useContext(PopoverContext);

  return (
    <div
      onClick={toggleOpen}
      className={cn('popover__trigger cursor-pointer', className)}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label="Open Popover"
      {...props}
    >
      {children}
    </div>
  );
};

type PopoverContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  side?: Side;
  align?: Align;
};

export const PopoverContent = ({
  className,
  children,
  side = 'bottom',
  align = 'start',
  ...props
}: PopoverContentProps) => {
  const { isOpen } = useContext(PopoverContext);
  const positionClasses = getSideAlignClasses(side, align);

  return (
    <div
      className={cn(
        'popover__content absolute z-30 w-72 rounded-md shadow-md outline-none border border-solid border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-600',
        'transition-all duration-200 ease-in-out transform origin-top-left',
        isOpen
          ? 'opacity-100 scale-100 pointer-events-auto'
          : 'opacity-0 scale-90 pointer-events-none',
        positionClasses,
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label="Popover Dialog"
      {...props}
    >
      {children}
    </div>
  );
};
