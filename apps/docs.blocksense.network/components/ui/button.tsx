import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors disabled:pointer-events-none disabled:opacity-50 focus:ring-1 focus:ring-gray-300 focus:ring-offset-0 focus:ring-opacity-100 focus:ring-offset-transparent focus:ring-offset-none focus:shadow-sm border border-neutral-200 rounded-md',
  {
    variants: {
      variant: {
        default:
          'h-10 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:border-neutral-600 dark:text-white',
        destructive:
          'h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'h-10 border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'h-10 hover:bg-accent hover:text-accent-foreground',
        link: 'h-10 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-4 py-2',
        secondary: 'h-[2.625rem]',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
