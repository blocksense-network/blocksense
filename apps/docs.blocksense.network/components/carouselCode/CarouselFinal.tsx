'use client';

import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  KeyboardEvent,
  HTMLAttributes,
  RefObject,
  ReactNode,
  createContext,
} from 'react';

import { cn } from '@blocksense/ui/utils';
import { Button } from '@blocksense/ui/Button';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';

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
  const contentRef = useRef<HTMLDivElement>(null); // Ref for CarouselContent
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = contentRef.current; // Use contentRef instead of carouselRef
    if (container) {
      const {
        scrollLeft,
        scrollTop,
        scrollWidth,
        scrollHeight,
        clientWidth,
        clientHeight,
      } = container;

      const SCROLL_THRESHOLD_BUFFER = 5; // Accounts for minor browser rounding inaccuracies

      if (orientation === 'horizontal') {
        setCanScrollPrev(scrollLeft > 0);
        setCanScrollNext(
          scrollLeft + clientWidth < scrollWidth - SCROLL_THRESHOLD_BUFFER,
        );
      } else {
        setCanScrollPrev(scrollTop > 0);
        setCanScrollNext(
          scrollTop + clientHeight < scrollHeight - SCROLL_THRESHOLD_BUFFER,
        );
      }
    }
  }, [orientation]);

  const scrollPrev = useCallback(() => {
    const container = contentRef.current; // Use contentRef instead of carouselRef
    if (container) {
      if (orientation === 'horizontal') {
        container.scrollBy({
          left: -container.clientWidth,
          behavior: 'smooth',
        });
      } else {
        container.scrollBy({
          top: -container.clientHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [orientation]);

  const scrollNext = useCallback(() => {
    const container = contentRef.current; // Use contentRef instead of carouselRef
    if (container) {
      if (orientation === 'horizontal') {
        container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
      } else {
        container.scrollBy({ top: container.clientHeight, behavior: 'smooth' });
      }
    }
  }, [orientation]);

  useEffect(() => {
    const container = contentRef.current; // Use contentRef instead of carouselRef
    if (container) {
      updateScrollState();
      container.addEventListener('scroll', updateScrollState);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
      };
    }
    return undefined; // Explicitly return undefined when no cleanup is needed
  }, [updateScrollState]);

  return (
    <CarouselContext.Provider
      value={{
        contentRef, // Pass contentRef to the context
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
  const { contentRef, orientation } = useContext(CarouselContext); // Use the useCarousel hook to ensure non-null context

  return (
    <div ref={contentRef} className="overflow-hidden">
      <div
        className={cn(
          'carousel__content flex',
          orientation === 'horizontal' ? '' : 'flex-col items-center',
          className,
        )}
        {...props}
      >
        {children}
      </div>
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
}: React.ComponentProps<typeof Button>) => {
  const { scrollPrev, canScrollPrev, orientation } =
    useContext(CarouselContext);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'carousel__prev-button absolute h-8 w-8 rounded-full',
        orientation === 'horizontal'
          ? '-left-12 top-1/2 -translate-y-1/2'
          : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ImageWrapper
        src="/icons/chevron-right.svg"
        alt="Arrow up down"
        className="h-4 w-4 invert rotate-180"
      />
    </Button>
  );
};

export const CarouselNext = ({
  className,
  variant = 'outline',
  size = 'icon',
  ...props
}: React.ComponentProps<typeof Button>) => {
  const { scrollNext, canScrollNext, orientation } =
    useContext(CarouselContext);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        'carousel__next-button absolute h-8 w-8 rounded-full',
        orientation === 'horizontal'
          ? '-right-12 top-1/2 -translate-y-1/2'
          : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ImageWrapper
        src="/icons/chevron-right.svg"
        alt="Arrow up down"
        className="h-4 w-4 invert"
      />
    </Button>
  );
};
