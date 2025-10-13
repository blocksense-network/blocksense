'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from 'react';

import { ImageWrapper } from '@blocksense/docs-ui/ImageWrapper';
import { cn } from '@blocksense/docs-ui/utils';

type AccordionContextType = {
  openItems: string[];
  type: 'single' | 'multiple';
  toggleItem: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextType>({
  openItems: [],
  type: 'multiple',
  toggleItem: () => {},
});

export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  type?: 'single' | 'multiple';
  value?: string[];
  ref?: RefObject<HTMLDivElement>;
}

export const Accordion = ({
  children,
  className,
  type = 'multiple',
  value = [],
  ...props
}: AccordionProps) => {
  const [openItems, setOpenItems] = useState<string[]>(value);

  useEffect(() => {
    setOpenItems(value);
  }, [value]);

  const toggleItem = (itemValue: string) => {
    setOpenItems(currentOpenItems => {
      if (type === 'single') {
        return currentOpenItems.includes(itemValue) ? [] : [itemValue];
      } else {
        return currentOpenItems.includes(itemValue)
          ? currentOpenItems.filter(val => val !== itemValue)
          : [...currentOpenItems, itemValue];
      }
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, type, toggleItem }}>
      <div className={cn('accordion', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

const AccordionItemContext = createContext<string>('');

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  value: string;
  className?: string;
}

export const AccordionItem = ({
  children,
  className,
  value,
  ...props
}: AccordionItemProps) => {
  const { openItems } = useContext(AccordionContext);
  const isOpen = openItems.includes(value);

  return (
    <AccordionItemContext.Provider value={value}>
      <div
        className={cn(
          'accordion-item border bg-slate-100 dark:bg-neutral-900 mb-4',
          isOpen
            ? 'border-blue-500'
            : 'border-neutral-200 dark:border-neutral-600',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
};

export interface AccordionTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
}

export const AccordionTrigger = ({
  children,
  className,
  onClick,
  ...props
}: AccordionTriggerProps) => {
  const itemValue = useContext(AccordionItemContext);
  const { openItems, toggleItem } = useContext(AccordionContext);
  const isOpen = openItems.includes(itemValue);

  return (
    <div className="accordion-item__header flex">
      <button
        type="button"
        onClick={e => {
          if (onClick) onClick(e);
          toggleItem(itemValue);
        }}
        className={cn(
          'accordion-item__trigger flex my-0 px-4 py-2 flex-1 items-center h-[44px] justify-between font-bold transition-all hover:underline focus:ring-0 focus:outline-none focus:border-none',
          className,
          isOpen && 'decoration-blue-500',
        )}
        {...props}
      >
        {children}
        <ImageWrapper
          src="/icons/chevron-down.svg"
          alt="chevron-down"
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            isOpen
              ? 'rotate-180 [filter:invert(59%)_sepia(78%)_saturate(2156%)_hue-rotate(196deg)_brightness(94%)_contrast(94%)]'
              : 'rotate-0 dark:invert',
          )}
        />
      </button>
    </div>
  );
};

export interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const AccordionContent = ({
  children,
  className,
  ...props
}: AccordionContentProps) => {
  const itemValue = useContext(AccordionItemContext);
  const { openItems } = useContext(AccordionContext);

  if (!openItems.includes(itemValue)) {
    return null;
  }

  return (
    <div
      className={cn(
        'accordion-item__content overflow-hidden text-sm transition-[max-height,opacity,padding] duration-500 ease-in-out bg-transparent max-h-[1540px] opacity-100 p-2 sm:p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Accordion.displayName = 'Accordion';
AccordionItem.displayName = 'AccordionItem';
AccordionTrigger.displayName = 'AccordionTrigger';
AccordionContent.displayName = 'AccordionContent';
