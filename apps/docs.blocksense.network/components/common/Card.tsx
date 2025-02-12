'use client';

import { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'default' | 'bordered' | 'shadow' | 'transparent';
type Size = 'sm' | 'md' | 'lg';

const variants = {
  default:
    'card card--default bg-card text-card-foreground dark:bg-neutral-900 dark:text-white',
  bordered:
    'card card--bordered border border-neutral-200 dark:border-neutral-600',
  shadow: 'card card--shadow shadow-md',
  transparent: 'card card--transparent bg-transparent',
};

const sizes = {
  sm: 'card--sm p-2',
  md: 'card--md p-4',
  lg: 'card--lg p-6',
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  size?: Size;
};

export const Card = ({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: CardProps) => {
  return (
    <div
      className={cn(
        'card border shadow-sm border-neutral-200 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white rounded-sm max-w-96 mt-10 transition-all',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
};

export const CardHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('card__header flex flex-col px-2 mb-4', className)}
    {...props}
  />
);

export const CardTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      'card__title text-2xl font-semibold leading-none tracking-tight dark:text-white',
      className,
    )}
    {...props}
  />
);

export const CardDescription = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <span
    className={cn('card__description text-sm text-muted-foreground', className)}
    {...props}
  />
);

export const CardContent = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('card__content p-4', className)} {...props} />
);

export const CardFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('card__footer flex items-center', className)} {...props} />
);

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';
