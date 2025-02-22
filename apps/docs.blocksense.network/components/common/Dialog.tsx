'use client';

import {
  useEffect,
  useRef,
  useState,
  ReactNode,
  MouseEvent,
  useCallback,
  useContext,
  createContext,
} from 'react';
import { cn } from '@/lib/utils';

const DialogContext = createContext<{
  open: boolean;
  setOpen: (value: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export const Dialog = ({
  className,
  children,
  open: controlledOpen,
  onOpenChange,
  ...props
}: {
  className?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpenState] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const dialogOpen = isControlled ? controlledOpen : open;

  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setOpenState(value);
    }
    if (onOpenChange) {
      onOpenChange(value);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialogOpen ? dialog.showModal() : dialog.close();
    }
  }, [dialogOpen]);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) {
        setOpen(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!dialogOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogOpen]);

  return (
    <DialogContext.Provider value={{ open: dialogOpen, setOpen }}>
      <dialog
        ref={dialogRef}
        className={cn(
          'dialog fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300',
          dialogOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          className,
        )}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <section className="dialog__content border border-solid border-neutral-200 bg-white dark:bg-neutral-900 p-6 shadow-lg rounded-sm max-w-lg w-full mx-auto">
          {children}
        </section>
      </dialog>
    </DialogContext.Provider>
  );
};

export const DialogTrigger = ({
  className,
  children,
  onClick,
  ...props
}: {
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) => {
  const { open, setOpen } = useContext(DialogContext);

  return (
    <button
      type="button"
      className={cn(
        'dialog__trigger',
        className,
        open && 'dialog__trigger--active',
      )}
      onClick={e => {
        if (onClick) onClick(e);
        setOpen(!open);
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export const DialogTitle = ({
  className,
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
}) => (
  <h2
    className={cn('dialog__title text-lg font-semibold', className)}
    {...props}
  >
    {children}
  </h2>
);

export const DialogHeader = ({
  className,
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
}) => (
  <header
    className={cn(
      'dialog__header mb-4 flex justify-between items-center',
      className,
    )}
    {...props}
  >
    {children}
  </header>
);

export const DialogContent = ({
  className,
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn('dialog__content-body', className)} {...props}>
    {children}
  </div>
);

export const DialogFooter = ({
  className,
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
}) => (
  <footer
    className={cn('dialog__footer mt-4 flex justify-end space-x-2', className)}
    {...props}
  >
    {children}
  </footer>
);

export const DialogClose = ({
  onCloseAction,
  children,
}: {
  onCloseAction: () => void;
  children: ReactNode;
}) => (
  <button
    onClick={onCloseAction}
    className="dialog__close-btn text-sm px-4 py-2 bg-neutral-200 dark:bg-neutral-900 rounded"
  >
    {children}
  </button>
);

Dialog.displayName = 'Dialog';
DialogTrigger.displayName = 'DialogTrigger';
DialogTitle.displayName = 'DialogTitle';
DialogHeader.displayName = 'DialogHeader';
DialogContent.displayName = 'DialogContent';
DialogFooter.displayName = 'DialogFooter';
DialogClose.displayName = 'DialogClose';
DialogContext.displayName = 'DialogContext';
