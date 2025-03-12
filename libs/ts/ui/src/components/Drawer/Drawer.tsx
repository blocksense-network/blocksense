'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { cn } from '@blocksense/ui/utils';

interface DrawerContextValue {
  isOpen: boolean;
  toggleOpen: () => void;
}

const DrawerContext = createContext<DrawerContextValue>(
  {} as DrawerContextValue,
);

export const Drawer = ({
  children,
  open,
  onOpenChange,
  className,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(open ?? false);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleClickOutside = useCallback((event: Event) => {
    const drawerElement = document.querySelector('.drawer__content');
    if (drawerElement && !drawerElement.contains(event.target as Node)) {
      handleClose();
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClickOutside, handleKeyDown]);

  const handleClose = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    onOpenChange?.(true);
  };

  return (
    <DrawerContext.Provider value={{ isOpen, toggleOpen: handleOpen }}>
      <div className={cn(className)}>{children}</div>
    </DrawerContext.Provider>
  );
};

export const DrawerTrigger = ({ children }: { children: ReactNode }) => {
  const { toggleOpen } = useContext(DrawerContext);

  return (
    <div onClick={toggleOpen} className="drawer__trigger cursor-pointer">
      {children}
    </div>
  );
};

export const DrawerContent = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const { isOpen } = useContext(DrawerContext);

  if (!isOpen) return null;
  return (
    <div
      className={cn(
        'drawer fixed inset-0 z-50 flex items-end justify-center w-full',
        className,
      )}
    >
      <div className="drawer__background fixed inset-0 bg-black opacity-75" />
      <section className="drawer__content w-full inset-x-1.5 bottom-0 z-50 flex h-[52vh] p-2 flex-col rounded-t-[4px] border border-neutral-200 bg-zinc-50 dark:text-neutral-200 dark:bg-neutral-900 dark:border-neutral-600">
        {children}
      </section>
    </div>
  );
};

export const DrawerHeader = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <header
    className={cn(
      'drawer__header grid gap-1 p-2 text-center sm:text-left',
      className,
    )}
  >
    {children}
  </header>
);

export const DrawerTitle = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <h2
    className={cn(
      'drawer__title text-md font-semibold leading-none tracking-tight',
      className,
    )}
  >
    {children}
  </h2>
);

export const DrawerDescription = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <p
    className={cn(
      'drawer__description text-sm text-muted-foreground',
      className,
    )}
  >
    {children}
  </p>
);

Drawer.displayName = 'Drawer';
DrawerTrigger.displayName = 'DrawerTrigger';
DrawerContent.displayName = 'DrawerContent';
DrawerHeader.displayName = 'DrawerHeader';
DrawerTitle.displayName = 'DrawerTitle';
DrawerDescription.displayName = 'DrawerDescription';
