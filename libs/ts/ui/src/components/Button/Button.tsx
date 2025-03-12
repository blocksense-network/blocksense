'use client';

import React from 'react';
import { FocusEventHandler, MouseEventHandler, ReactNode } from 'react';

import { cn } from '@blocksense/ui/utils';

type Variant =
  | 'action'
  | 'danger'
  | 'outline'
  | 'highlight'
  | 'transparent'
  | 'link';

type Size = 'base' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';

const variants = {
  action:
    'button--action bg-action text-action-foreground hover:bg-action/90 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white',
  danger: 'button--danger bg-danger text-danger-foreground hover:bg-danger/90',
  outline:
    'button--outline border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  highlight:
    'button--highlight bg-highlight text-highlight-foreground hover:bg-highlight/80',
  transparent:
    'button--transparent hover:bg-accent hover:text-accent-foreground',
  link: 'button--link text-primary underline underline-offset-2 font-bold hover:bg-action/90 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white',
};

const sizes = {
  base: 'button--base-size px-4 py-2 h-10',
  sm: 'button--sm-size h-9 px-3',
  md: 'button--md-size h-10 px-6',
  lg: 'button--lg-size h-11 px-8',
  xl: 'button--xl-size h-12 px-10',
  icon: 'button--icon-size h-10 w-10 flex items-center justify-center',
};

type ButtonProps = {
  className?: string;
  variant?: Variant;
  size?: Size;
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  onFocus?: FocusEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  children?: ReactNode;
  icon?: ReactNode;
  content?: string;
  disabled?: boolean;
};

const ButtonBase = ({
  className,
  href,
  target,
  onFocus,
  onClick,
  onMouseEnter,
  onMouseLeave,
  icon,
  children,
  content,
  ...props
}: ButtonProps) => {
  const Component = href ? 'a' : 'button';

  return (
    <Component
      href={href}
      className={className}
      target={target}
      {...(href && target === '_blank' ? { rel: 'noopener noreferrer' } : {})}
      onFocus={onFocus}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {content || children}
    </Component>
  );
};

export const Button = ({
  className,
  variant = 'action',
  size = 'base',
  disabled = false,
  ...props
}: ButtonProps) => {
  const baseClasses =
    'button inline-flex items-center justify-center rounded-sm text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 border border-neutral-200';

  const classNames = cn(baseClasses, variants[variant], sizes[size], className);

  return <ButtonBase className={classNames} disabled={disabled} {...props} />;
};

Button.displayName = 'Button';
