'use client';

import React, {
  createContext,
  useContext,
  useState,
  HTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@blocksense/ui/utils';

type ScrollAreaContextType = {
  scrollPosition: number;
  setScrollPosition: (position: number) => void;
};

const ScrollAreaContext = createContext<ScrollAreaContextType>({
  scrollPosition: 0,
  setScrollPosition: () => {},
});

export const useScrollArea = () => useContext(ScrollAreaContext);

type ScrollAreaProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

export const ScrollArea = ({
  children,
  className,
  ...props
}: ScrollAreaProps) => {
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollAreaId = 'scroll-area-content';

  return (
    <ScrollAreaContext.Provider value={{ scrollPosition, setScrollPosition }}>
      <section
        className={cn('scroll-area max-h-[100vh] overflow-auto', className)}
        role="region"
        aria-label="Scrollable content"
        {...props}
      >
        <article
          id={scrollAreaId}
          className="scroll-area__content max-h-[100%] overflow-auto"
          aria-labelledby="scroll-area-label"
        >
          {children}
        </article>
        <ScrollBar
          className="scroll-area__scrollbar"
          scrollPosition={scrollPosition}
          scrollAreaId={scrollAreaId}
        />
      </section>
    </ScrollAreaContext.Provider>
  );
};

type ScrollBarProps = HTMLAttributes<HTMLElement> & {
  className?: string;
  orientation?: 'vertical' | 'horizontal';
  scrollPosition?: number;
  scrollAreaId?: string;
};

export const ScrollBar = ({
  className,
  orientation = 'vertical',
  scrollPosition = 0,
  scrollAreaId,
  ...props
}: ScrollBarProps) => {
  return (
    <aside
      className={cn(
        'scroll-bar',
        orientation === 'vertical'
          ? 'scroll-bar--vertical'
          : 'scroll-bar--horizontal',
        className,
      )}
      role="scrollbar"
      aria-orientation={orientation}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={scrollPosition}
      aria-controls={scrollAreaId}
      {...props}
    >
      <div
        className="scroll-bar__thumb outline-none"
        tabIndex={0}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={scrollPosition}
        aria-controls={scrollAreaId}
        aria-label="Scroll thumb"
      />
    </aside>
  );
};

ScrollArea.displayName = 'ScrollArea';
ScrollBar.displayName = 'ScrollBar';
