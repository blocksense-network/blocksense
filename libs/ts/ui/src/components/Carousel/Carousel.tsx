'use client';

import React, {
  useState,
  useEffect,
  useRef,
  HTMLAttributes,
  RefObject,
  ReactNode,
  createContext,
  useContext,
} from 'react';

import { cn } from '@blocksense/ui/utils';
import { Button } from '@blocksense/ui/Button';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';
import { ButtonProps } from '@blocksense/ui/Button';

type CarouselProps = {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children?: ReactNode;
};

type CarouselContextProps = {
  contentRef: RefObject<HTMLDivElement>;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  orientation: 'horizontal' | 'vertical';
};

const CarouselContext = createContext<CarouselContextProps>(
  {} as CarouselContextProps,
);

export const Carousel = ({
  orientation = 'horizontal',
  className,
  children,
  ...props
}: CarouselProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [itemsCount, setItemsCount] = useState(1);
  const [currentItem, setCurrentItem] = useState(1);

  const updateScrollState = (currentIndex: number, totalItems: number) => {
    setCanScrollNext(currentIndex < totalItems);
    setCanScrollPrev(currentIndex > 1);
  };

  const scrollByAmount = (amount: number) => {
    const container = contentRef.current;
    if (container) {
      if (orientation === 'horizontal') {
        container.scrollBy({ left: amount, behavior: 'smooth' });
      } else {
        container.scrollBy({ top: amount, behavior: 'smooth' });
      }
    }
  };

  const scrollPrev = () => {
    const container = contentRef.current;
    if (container) {
      const scrollAmount =
        orientation === 'horizontal'
          ? -container.clientWidth
          : -container.clientHeight;
      scrollByAmount(scrollAmount);

      setCurrentItem(prevItem => {
        const newItem = Math.max(prevItem - 1, 1);
        updateScrollState(newItem, itemsCount);
        return newItem;
      });
    }
  };

  const scrollNext = () => {
    const container = contentRef.current;
    if (container) {
      const scrollAmount =
        orientation === 'horizontal'
          ? container.clientWidth
          : container.clientHeight;
      scrollByAmount(scrollAmount);

      setCurrentItem(prevItem => {
        const newItem = Math.min(prevItem + 1, itemsCount);
        updateScrollState(newItem, itemsCount);
        return newItem;
      });
    }
  };

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      const currentItems = container.children.length;
      setItemsCount(currentItems);
      updateScrollState(currentItem, currentItems);
    }
  }, []);

  return (
    <CarouselContext.Provider
      value={{
        contentRef,
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
        orientation,
      }}
    >
      <div
        className={cn('carousel relative', className)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
};

export const CarouselContent = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { contentRef, orientation } = useContext(CarouselContext);

  return (
    <div
      ref={contentRef}
      role="group"
      aria-label="Carousel Content"
      aria-orientation={orientation}
      className={cn(
        'carousel__content flex overflow-hidden',
        orientation === 'vertical' && 'flex-col items-center',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CarouselItem = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn(
        'carousel__item flex flex-shrink-0 flex-grow-0 basis-full justify-center items-center',
        className,
      )}
      role="group"
      aria-roledescription="slide"
      {...props}
    >
      {children}
    </div>
  );
};

export const CarouselPrevious = ({
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: ButtonProps) => {
  const { scrollPrev, canScrollPrev, orientation } =
    useContext(CarouselContext);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'carousel__prev-button absolute h-8 w-8 rounded-full',
        orientation === 'horizontal'
          ? 'left-6 top-1/2 -translate-y-1/2'
          : 'top-6 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous Slide"
      {...props}
    >
      <ImageWrapper
        src="/icons/chevron-left.svg"
        alt="Previous Slide"
        className="h-4 w-4 invert"
      />
    </Button>
  );
};

export const CarouselNext = ({
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: ButtonProps) => {
  const { scrollNext, canScrollNext, orientation } =
    useContext(CarouselContext);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'carousel__next-button absolute h-8 w-8 rounded-full',
        orientation === 'horizontal'
          ? 'right-6 top-1/2 -translate-y-1/2'
          : 'bottom-6 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next Slide"
      {...props}
    >
      <ImageWrapper
        src="/icons/chevron-right.svg"
        alt="Next Slide"
        className="h-4 w-4 invert"
      />
    </Button>
  );
};
