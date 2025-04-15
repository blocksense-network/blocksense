'use client';

import { ButtonHTMLAttributes, MouseEvent } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
};

export const Button = ({
  children,
  className = '',
  disabled,
  isLoading,
  onClick,
  variant = 'primary',
  ...props
}: ButtonProps) => {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const variantStyle = {
    primary: 'bg-[var(--neon-yellow)]',
    secondary: 'bg-[var(--white)]',
  };

  return (
    <button
      className={`button ${variantStyle[variant]} text-[var(--black)] px-8 py-4 cursor-pointer rounded-[2.5rem] font-bold tracking-[-0.32px] leading-[120%] ${disabled && 'opacity-[0.3] pointer-events-none'} ${isLoading && `${variantStyle['secondary']} flex gap-1 items-center justify-center`} ${className}`}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
      {isLoading && (
        <img src="/icons/loading.svg" alt="Loading" className="animate-spin" />
      )}
    </button>
  );
};
