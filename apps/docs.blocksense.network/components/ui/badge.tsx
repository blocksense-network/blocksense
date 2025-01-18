import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 mr-4 mt-4 mb-4 text-sm font-semibold transition-colors hover:bg-neutral-50 hover:border-gray-600 focus:ring-1 focus:ring-gray-300 focus:ring-offset-0 focus:ring-opacity-100 focus:ring-offset-transparent focus:ring-offset-none focus:shadow-sm border border-gray-200 rounded-md  dark:bg-neutral-900 dark:border-neutral-600 dark:hover:bg-black',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        accentary:
          'border-transparent bg-sky-700 text-primary-foreground hover:bg-primary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
