'use client';

import React, {
  useEffect,
  useRef,
  useState,
  ReactNode,
  MouseEvent,
  useCallback,
  useContext,
  createContext,
  HTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';
import { Icon } from '@blocksense/ui/Icon';
import { Button } from '@blocksense/ui/Button';

type DialogProps = {
  isOpen?: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
};

const DialogContext = createContext<{
  open: boolean;
  setOpen: (value: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export const Dialog = ({
  isOpen,
  onClose,
  children,
  className,
  ...props
}: DialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpenState] = useState(false);

  const dialogOpen = isOpen !== undefined ? isOpen : open;

  const setOpen = (value: boolean) => {
    setOpenState(value);
    if (onClose && !value) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (dialogOpen) {
      document.body.classList.add('overflow-hidden');
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogOpen]);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDialogElement>) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    },
    [],
  );

  if (!dialogOpen) return null;

  return (
    <DialogContext.Provider value={{ open: dialogOpen, setOpen }}>
      <dialog
        className={cn(
          'dialog fixed inset-0 z-50 flex items-center justify-center w-full',
          className,
        )}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div className="dialog__background fixed inset-0 bg-black opacity-75"></div>
        <section
          ref={dialogRef}
          className="dialog__content fixed top-[15%] max-h-[70%] bg-white p-6 shadow-lg z-10 w-[48rem] dark:bg-neutral-900 dark:border-neutral-600"
        >
          {children}
        </section>
      </dialog>
    </DialogContext.Provider>
  );
};

type DialogContentProps = {
  children: ReactNode;
  className?: string;
};

export const DialogContent = ({
  children,
  className,
  ...props
}: DialogContentProps) => (
  <div
    className={cn(
      'dialog__content-body relative bg-white z-10 max-w-lg w-full dark:bg-neutral-900 dark:border-neutral-600',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

type DialogTriggerProps = {
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  asChild?: boolean;
};

export const DialogTrigger = ({
  className,
  children,
  onClick,
  asChild = false,
  ...props
}: DialogTriggerProps) => {
  const { open, setOpen } = useContext(DialogContext);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    setOpen(!open);
  };

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: handleClick,
    });
  }

  return (
    <Button
      className={cn(
        'dialog__trigger',
        className,
        open && 'dialog__trigger--active',
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Button>
  );
};

export const DialogHeader = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadElement>) => (
  <header
    className={cn('dialog__header flex flex-col space-y-1.5 mb-4', className)}
    {...props}
  >
    {children}
  </header>
);

export const DialogTitle = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn('dialog__title text-lg font-semibold', className)}
    {...props}
  >
    {children}
  </h2>
);

export const DialogDescription = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn(
      'dialog__description text-sm text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </p>
);

export const DialogFooter = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <footer
    className={cn('dialog__footer mt-4 flex justify-end space-x-2', className)}
    {...props}
  >
    {children}
  </footer>
);

type DialogCloseProps = {
  onClick: () => void;
  children: ReactNode;
};

export const DialogClose = ({ onClick, children }: DialogCloseProps) => (
  <Button
    onClick={onClick}
    className="dialog__close-btn p-0 h-4 absolute -top-2 -right-2 text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xs"
  >
    <Icon
      className="h-4 w-4"
      size="xs"
      icon={{
        type: 'image',
        src: '/icons/escape.svg',
      }}
      ariaLabel="Escape"
    />
    <span className="sr-only">{children}</span>
  </Button>
);

Dialog.displayName = 'Dialog';
DialogContent.displayName = 'DialogContent';
DialogTrigger.displayName = 'DialogTrigger';
DialogHeader.displayName = 'DialogHeader';
DialogTitle.displayName = 'DialogTitle';
DialogDescription.displayName = 'DialogDescription';
DialogFooter.displayName = 'DialogFooter';
DialogClose.displayName = 'DialogClose';
DialogContext.displayName = 'DialogContext';
