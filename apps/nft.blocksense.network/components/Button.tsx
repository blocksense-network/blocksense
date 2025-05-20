'use client';

import { ButtonHTMLAttributes, MouseEvent } from 'react';
import Image from 'next/image';

import loadingIcon from '/public/icons/loading.svg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
};

const variantStyle = {
  primary:
    'bg-[var(--neon-yellow)] hover:bg-[var(--white)] transition-colors duration-350',
  secondary:
    'bg-[var(--white)] hover:bg-[var(--gray-light)] transition-colors duration-350',
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

  return (
    <button
      className={`button ${variantStyle[variant]} text-[var(--black)] px-8 py-4 cursor-pointer rounded-[2.5rem] font-semibold tracking-[-0.02rem] leading-[120%] ${disabled && 'opacity-[0.3] pointer-events-none'} ${isLoading && `${variantStyle['secondary']} flex gap-1 items-center justify-center`} ${className}`}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
      {isLoading && (
        <Image src={loadingIcon} alt="Loading" className="animate-spin" />
      )}
    </button>
  );
};
