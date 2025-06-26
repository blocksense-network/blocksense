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
  ButtonHTMLAttributes,
} from 'react';

import { cn } from '@blocksense/docs-ui/utils';
import { Icon } from '@blocksense/docs-ui/Icon';
import { Button } from '@blocksense/docs-ui/Button';

interface DialogContextValue {
  isOpen: boolean;
  handleOpen: () => void;
  handleClose: () => void;
  dialogRef: RefObject<HTMLDivElement>;
}
const DialogContext = createContext<DialogContextValue>(
  {} as DialogContextValue,
);

export const Dialog = ({
  children,
  isOpen,
  onClose,
}: {
  children: ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const actualOpen = isOpen ?? internalOpen;

  useEffect(() => {
    if (!actualOpen) {
      document.body.classList.remove('overflow-hidden');
      return;
    }

    document.body.classList.add('overflow-hidden');

    const handleClickOutside = (event: Event) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [actualOpen]);

  const handleClose = () => {
    setInternalOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleOpen = () => {
    setInternalOpen(true);
  };

  return (
    <DialogContext.Provider
      value={{ isOpen: actualOpen, handleOpen, handleClose, dialogRef }}
    >
      {children}
    </DialogContext.Provider>
  );
};

export const DialogTrigger = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
}) => {
  const { handleOpen } = useContext(DialogContext);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    handleOpen();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      {...props}
      className={cn('dialog__trigger cursor-pointer', props.className)}
    >
      {children}
    </div>
  );
};

type DialogContentProps = {
  className?: string;
  children: ReactNode;
};

export const DialogContent = ({
  className,
  children,
  ...props
}: DialogContentProps) => {
  const { isOpen, dialogRef } = useContext(DialogContext);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'dialog fixed inset-0 z-50 flex items-center justify-center w-full',
        className,
      )}
      role="dialog"
      aria-modal="true"
      {...props}
    >
      <div className="dialog__background fixed inset-0 bg-black opacity-75" />
      <section
        ref={dialogRef}
        className="dialog__content fixed top-[15%] left-1/2 transform -translate-x-1/2 max-h-[80%] bg-white p-6 shadow-lg z-10 w-[48rem] dark:bg-neutral-900 border dark:border-neutral-600"
      >
        {children}
      </section>
    </div>
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
  <p className={cn('dialog__description text-sm', className)} {...props}>
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

export const DialogClose = ({
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { handleClose } = useContext(DialogContext);

  return (
    <Button
      onClick={handleClose}
      className="dialog__close-btn p-0 h-4 absolute top-4 right-4 text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xs"
      {...props}
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
    </Button>
  );
};

Dialog.displayName = 'Dialog';
DialogContent.displayName = 'DialogContent';
DialogTrigger.displayName = 'DialogTrigger';
DialogHeader.displayName = 'DialogHeader';
DialogTitle.displayName = 'DialogTitle';
DialogDescription.displayName = 'DialogDescription';
DialogFooter.displayName = 'DialogFooter';
DialogClose.displayName = 'DialogClose';
DialogContext.displayName = 'DialogContext';
